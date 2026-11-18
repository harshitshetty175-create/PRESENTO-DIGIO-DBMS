import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { TAX_RATE, round2 } from "@/lib/utils";
import { notify, audit } from "@/lib/notify";
import { checkoutSchema } from "@/validations";

/**
 * POST /api/checkout — the critical transaction.
 * Never trusts client totals: prices, delivery fee, tax and coupon discount
 * are all recomputed from the database inside a single transaction.
 * Stock is decremented with a conditional UPDATE (stock_qty >= qty) so a
 * concurrent checkout cannot oversell; 0 affected rows rolls everything back.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { addressId, couponCode, instructions, paymentMethod, idempotencyKey } =
    parsed.data;

  // Idempotency pre-check (also re-checked inside the transaction).
  const existing = await prisma.order.findUnique({
    where: { idempotency_key: idempotencyKey },
  });
  if (existing) {
    return json({
      orderId: existing.id,
      total: Number(existing.total_amount),
      status: existing.status,
      idempotent: true,
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // (1) Idempotency inside the transaction (race-safe).
      const dup = await tx.order.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      if (dup) {
        return {
          orderId: dup.id,
          total: Number(dup.total_amount),
          status: dup.status,
          existing: true,
        };
      }

      // (2) Load the cart with food, restaurant and inventory.
      const cart = await tx.cart.findUnique({
        where: { user_id: session.id },
        include: {
          items: {
            include: {
              food_item: { include: { inventory: true } },
            },
          },
        },
      });
      if (!cart || cart.items.length === 0) {
        throw new Error("Your cart is empty");
      }
      if (!cart.restaurant_id) {
        throw new Error("Cart has no restaurant");
      }
      const restaurant = await tx.restaurant.findUnique({
        where: { id: cart.restaurant_id },
      });
      if (!restaurant || !restaurant.is_active) {
        throw new Error("Restaurant is unavailable");
      }
      if (!restaurant.is_open) {
        throw new Error("Restaurant is currently closed");
      }

      if (addressId) {
        const address = await tx.address.findFirst({
          where: { id: addressId, user_id: session.id },
        });
        if (!address) throw new Error("Delivery address not found");
      }

      // (3) Availability + atomic stock decrement per item.
      for (const item of cart.items) {
        const food = item.food_item;
        if (!food.is_available) {
          throw new Error(`"${food.name}" is no longer available`);
        }
        if (food.inventory) {
          const affected = await tx.$executeRaw`
            UPDATE inventory
            SET stock_qty = stock_qty - ${item.qty}
            WHERE food_item_id = ${food.id} AND stock_qty >= ${item.qty}`;
          if (affected === 0) {
            throw new Error(`Insufficient stock for "${food.name}"`);
          }
        }
        // Items without an inventory row (legacy/seed data) skip the
        // decrement rather than failing the whole order.
      }

      // (4) Server-side price recalculation from DB prices.
      let subtotal = 0;
      const orderItemsData = cart.items.map((item) => {
        const unitPrice = Number(item.food_item.price);
        const lineTotal = round2(unitPrice * item.qty);
        subtotal = round2(subtotal + lineTotal);
        return {
          food_item_id: item.food_item_id,
          item_name: item.food_item.name,
          unit_price: unitPrice,
          qty: item.qty,
          line_total: lineTotal,
        };
      });

      if (subtotal < Number(restaurant.min_order)) {
        throw new Error(
          `Minimum order for this restaurant is ₹${Number(restaurant.min_order)}`,
        );
      }

      const deliveryFee = Number(restaurant.delivery_fee);

      // Coupon validation: active, in date range, min order, not used by user.
      let discount = 0;
      let coupon: { id: number; code: string } | null = null;
      if (couponCode) {
        const now = new Date();
        const found = await tx.coupon.findUnique({
          where: { code: couponCode.trim().toUpperCase() },
        });
        if (!found || !found.is_active) {
          throw new Error("Coupon is invalid or inactive");
        }
        if (found.valid_from > now || (found.valid_to && found.valid_to < now)) {
          throw new Error("Coupon is not valid at this time");
        }
        if (subtotal < Number(found.min_order)) {
          throw new Error(
            `Coupon requires a minimum order of ₹${Number(found.min_order)}`,
          );
        }
        const alreadyUsed = await tx.couponUsage.findFirst({
          where: { coupon_id: found.id, user_id: session.id },
        });
        if (alreadyUsed) {
          throw new Error("You have already used this coupon");
        }
        const rawDiscount = round2(
          (subtotal * Number(found.discount_percent)) / 100,
        );
        const cap = Number(found.max_discount);
        discount = cap > 0 ? Math.min(rawDiscount, cap) : rawDiscount;
        coupon = found;
      }

      const taxable = round2(Math.max(0, subtotal - discount));
      const tax = round2(taxable * TAX_RATE);
      const total = round2(taxable + deliveryFee + tax);

      // (5) Create Order + OrderItems + Payment + status history (+ coupon usage).
      const order = await tx.order.create({
        data: {
          user_id: session.id,
          restaurant_id: restaurant.id,
          address_id: addressId ?? null,
          status: "PLACED",
          subtotal,
          delivery_fee: deliveryFee,
          tax_amount: tax,
          discount_amount: discount,
          total_amount: total,
          coupon_code: coupon ? coupon.code : null,
          instructions: instructions ?? null,
          idempotency_key: idempotencyKey,
          items: { create: orderItemsData },
          status_history: {
            create: { new_status: "PLACED", changed_by: session.id },
          },
        },
      });

      const isSimulated = paymentMethod !== "COD";
      await tx.payment.create({
        data: {
          order_id: order.id,
          amount: total,
          method: paymentMethod,
          status: isSimulated ? "SUCCESS" : "PENDING",
          // Simulated payments are labelled SIMULATED; no real card data.
          reference: isSimulated
            ? `SIM-${Date.now()}-${order.id}`
            : null,
        },
      });

      if (coupon) {
        await tx.couponUsage.create({
          data: { coupon_id: coupon.id, user_id: session.id, order_id: order.id },
        });
      }

      // (6) Clear the cart.
      await tx.cartItem.deleteMany({ where: { cart_id: cart.id } });
      await tx.cart.delete({ where: { id: cart.id } });

      return {
        orderId: order.id,
        total,
        status: order.status,
        restaurantId: restaurant.id,
        restaurantOwnerId: restaurant.owner_id,
        existing: false,
      };
    });

    if (result.existing) {
      return json({
        orderId: result.orderId,
        total: result.total,
        status: result.status,
        idempotent: true,
      });
    }

    // Notifications + audit log (best-effort, after the transaction commits).
    await notify(
      session.id,
      "Order placed",
      `Your order #${result.orderId} has been placed. Total ₹${result.total}.`,
      "ORDER",
    );
    if (result.restaurantOwnerId !== undefined) {
      await notify(
        result.restaurantOwnerId,
        "New order received",
        `New order #${result.orderId} (₹${result.total}) is waiting for confirmation.`,
        "ORDER",
      );
    }
    await audit(session.id, "ORDER_PLACE", "orders", result.orderId, {
      total: result.total,
      payment_method: paymentMethod,
    });

    return json(
      { orderId: result.orderId, total: result.total, status: result.status },
      201,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    console.error("[checkout]", e);
    return err(message, 400);
  }
}
