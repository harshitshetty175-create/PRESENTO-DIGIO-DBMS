import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { round2 } from "@/lib/utils";
import { cartAddSchema, cartUpdateSchema } from "@/validations";

async function getCartWithItems(userId: number) {
  return prisma.cart.findUnique({
    where: { user_id: userId },
    include: {
      items: {
        include: {
          food_item: {
            include: {
              restaurant: { select: { id: true, name: true } },
              inventory: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
}

function serializeCart(
  cart: Awaited<ReturnType<typeof getCartWithItems>>,
) {
  if (!cart) return { id: null, restaurantId: null, items: [], subtotal: 0 };
  const items = cart.items.map((ci) => {
    const price = Number(ci.food_item.price);
    return {
      id: ci.id,
      foodItemId: ci.food_item_id,
      name: ci.food_item.name,
      price,
      qty: ci.qty,
      lineTotal: round2(price * ci.qty),
      restaurantId: ci.food_item.restaurant_id,
      restaurantName: ci.food_item.restaurant.name,
      imageUrl: ci.food_item.image_url,
      isVeg: ci.food_item.is_veg,
      stockQty: ci.food_item.inventory?.stock_qty ?? null,
    };
  });
  return {
    id: cart.id,
    restaurantId: cart.restaurant_id,
    items,
    subtotal: round2(items.reduce((s, i) => s + i.lineTotal, 0)),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const cart = await getCartWithItems(session.id);
  return json({ cart: serializeCart(cart) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = cartAddSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { foodItemId, qty } = parsed.data;

  const food = await prisma.foodItem.findUnique({
    where: { id: foodItemId },
    include: { inventory: true },
  });
  if (!food) return err("Food item not found", 404);
  if (!food.is_available) return err(`"${food.name}" is not available`, 400);
  if (food.inventory && food.inventory.stock_qty < qty) {
    return err(`Only ${food.inventory.stock_qty} left in stock for "${food.name}"`, 409);
  }

  const existingCart = await prisma.cart.findUnique({
    where: { user_id: session.id },
    include: { items: true },
  });

  // One-restaurant rule: clear the cart before switching restaurants.
  if (
    existingCart?.restaurant_id &&
    existingCart.restaurant_id !== food.restaurant_id
  ) {
    return err(
      "Your cart already has items from another restaurant. Clear the cart first to switch restaurants.",
      409,
    );
  }

  const cart =
    existingCart ??
    (await prisma.cart.create({
      data: { user_id: session.id, restaurant_id: food.restaurant_id },
      include: { items: true },
    }));

  const existingItem = await prisma.cartItem.findUnique({
    where: { cart_id_food_item_id: { cart_id: cart.id, food_item_id: foodItemId } },
  });
  const newQty = (existingItem?.qty ?? 0) + qty;
  if (food.inventory && food.inventory.stock_qty < newQty) {
    return err(
      `Only ${food.inventory.stock_qty} left in stock for "${food.name}"`,
      409,
    );
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { qty: newQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cart_id: cart.id, food_item_id: foodItemId, qty },
    });
  }

  const updated = await getCartWithItems(session.id);
  return json({ cart: serializeCart(updated) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = cartUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { foodItemId, qty } = parsed.data;

  const cart = await prisma.cart.findUnique({
    where: { user_id: session.id },
    include: { items: true },
  });
  if (!cart) return err("Cart is empty", 400);

  const item = cart.items.find((ci) => ci.food_item_id === foodItemId);
  if (!item) return err("Item not in cart", 404);

  if (qty === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const food = await prisma.foodItem.findUnique({
      where: { id: foodItemId },
      include: { inventory: true },
    });
    if (!food || !food.is_available) {
      return err("Food item is no longer available", 400);
    }
    if (food.inventory && food.inventory.stock_qty < qty) {
      return err(
        `Only ${food.inventory.stock_qty} left in stock for "${food.name}"`,
        409,
      );
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { qty } });
  }

  const updated = await getCartWithItems(session.id);
  return json({ cart: serializeCart(updated) });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const cart = await prisma.cart.findUnique({ where: { user_id: session.id } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });
    await prisma.cart.delete({ where: { id: cart.id } });
  }
  return json({ cart: { id: null, restaurantId: null, items: [], subtotal: 0 } });
}
