import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { canTransition } from "@/lib/utils";
import { notify, audit } from "@/lib/notify";
import { orderStatusSchema } from "@/validations";
import type { OrderStatus } from "@/types";

type Params = { params: Promise<{ id: string }> };

async function loadOrder(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: true,
      address: true,
      user: { select: { id: true, name: true, email: true } },
      deliveries: { include: { partner: true } },
      restaurant: {
        select: {
          id: true,
          name: true,
          owner_id: true,
          admins: { select: { user_id: true } },
        },
      },
      status_history: { orderBy: { created_at: "asc" } },
    },
  });
}

function canView(
  session: { id: number; role: string },
  order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>,
): boolean {
  if (session.role === "SUPER_ADMIN") return true;
  if (session.role === "CUSTOMER") return order.user_id === session.id;
  if (session.role === "RESTAURANT_ADMIN") {
    return (
      order.restaurant.owner_id === session.id ||
      order.restaurant.admins.some((a) => a.user_id === session.id)
    );
  }
  if (session.role === "DELIVERY_PARTNER") {
    return order.deliveries.some((d) => d.partner?.user_id === session.id);
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) return err("Invalid order id", 400);

  const order = await loadOrder(orderId);
  if (!order) return err("Order not found", 404);
  if (!canView(session, order)) return err("You cannot view this order", 403);
  return json({ order });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) return err("Invalid order id", 400);

  const body = await parseBody(req);
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const newStatus = parsed.data.status as OrderStatus;

  const order = await loadOrder(orderId);
  if (!order) return err("Order not found", 404);
  if (!canView(session, order)) return err("You cannot update this order", 403);

  // Role rules for who may set which status.
  const isRestaurantSide =
    session.role === "SUPER_ADMIN" ||
    (session.role === "RESTAURANT_ADMIN" &&
      (order.restaurant.owner_id === session.id ||
        order.restaurant.admins.some((a) => a.user_id === session.id)));
  const restaurantStatuses: OrderStatus[] = [
    "CONFIRMED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "REJECTED",
  ];
  const deliveryStatuses: OrderStatus[] = [
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];

  if (session.role === "CUSTOMER") {
    if (newStatus !== "CANCELLED") {
      return err("Customers can only cancel an order", 403);
    }
  } else if (session.role === "RESTAURANT_ADMIN") {
    if (!restaurantStatuses.includes(newStatus)) {
      return err("Restaurant admins cannot set this status", 403);
    }
    if (!isRestaurantSide) {
      return err("You do not manage this order's restaurant", 403);
    }
  } else if (session.role === "DELIVERY_PARTNER") {
    if (!deliveryStatuses.includes(newStatus)) {
      return err("Delivery partners cannot set this status", 403);
    }
    const assigned = order.deliveries.some(
      (d) => d.partner?.user_id === session.id,
    );
    if (!assigned) {
      return err("You are not assigned to this delivery", 403);
    }
  }
  // SUPER_ADMIN may set any valid transition.

  if (!canTransition(order.status, newStatus)) {
    return err(`Cannot move order from ${order.status} to ${newStatus}`, 409);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
      await tx.orderStatusHistory.create({
        data: {
          order_id: orderId,
          old_status: order.status,
          new_status: newStatus,
          changed_by: session.id,
        },
      });
      if (newStatus === "DELIVERED") {
        // Cash-on-delivery is collected on delivery.
        await tx.payment.updateMany({
          where: { order_id: orderId, method: "COD", status: "PENDING" },
          data: { status: "SUCCESS" },
        });
      }
      if (newStatus === "CANCELLED" || newStatus === "REJECTED") {
        // Restore stock reserved at checkout.
        for (const item of order.items) {
          if (item.food_item_id) {
            await tx.inventory.updateMany({
              where: { food_item_id: item.food_item_id },
              data: { stock_qty: { increment: item.qty } },
            });
          }
        }
      }
      return next;
    });

    await notify(
      order.user_id,
      `Order #${orderId} ${newStatus.toLowerCase().replaceAll("_", " ")}`,
      `Your order from ${order.restaurant.name} is now ${newStatus.replaceAll("_", " ")}.`,
      "ORDER",
    );
    await audit(session.id, "ORDER_STATUS_CHANGE", "orders", orderId, {
      from: order.status,
      to: newStatus,
    });
    return json({ order: updated });
  } catch (e) {
    console.error("[orders PATCH]", e);
    return err("Failed to update order status", 500);
  }
}
