import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  ownedRestaurantIds,
  audit,
  serializeRows,
} from "../../_helpers";

/** GET /api/restaurant/inventory — inventory joined with food items for own restaurants. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["RESTAURANT_ADMIN", "SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let restaurantIds: number[];
  const override = req.nextUrl.searchParams.get("restaurantId");
  if (session.role === "SUPER_ADMIN" && override) {
    const id = parseInt(override, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "Invalid restaurantId" },
        { status: 400 }
      );
    }
    restaurantIds = [id];
  } else {
    restaurantIds = await ownedRestaurantIds(session);
  }

  const rows = await prisma.inventory.findMany({
    where: { food_item: { restaurant_id: { in: restaurantIds } } },
    include: {
      food_item: {
        select: {
          id: true,
          name: true,
          price: true,
          is_available: true,
          category: { select: { id: true, name: true } },
          restaurant: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { food_item: { name: "asc" } },
  });

  // Also surface food items that have no inventory row yet (stock unknown = 0).
  const withInventory = new Set(rows.map((r) => r.food_item_id));
  const bareItems = await prisma.foodItem.findMany({
    where: {
      restaurant_id: { in: restaurantIds },
      id: { notIn: [...withInventory] },
    },
    select: {
      id: true,
      name: true,
      price: true,
      is_available: true,
      category: { select: { id: true, name: true } },
      restaurant: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const inventory = serializeRows(
    rows.map((r) => ({
      id: r.id,
      foodItemId: r.food_item_id,
      foodName: r.food_item.name,
      restaurantId: r.food_item.restaurant.id,
      restaurantName: r.food_item.restaurant.name,
      category: r.food_item.category.name,
      price: r.food_item.price,
      isAvailable: r.food_item.is_available,
      stockQty: r.stock_qty,
      lowStockAt: r.low_stock_at,
      isLowStock: r.stock_qty <= r.low_stock_at,
      updatedAt: r.updated_at,
    }))
  );
  const missing = serializeRows(
    bareItems.map((f) => ({
      id: null,
      foodItemId: f.id,
      foodName: f.name,
      restaurantId: f.restaurant.id,
      restaurantName: f.restaurant.name,
      category: f.category.name,
      price: f.price,
      isAvailable: f.is_available,
      stockQty: 0,
      lowStockAt: 5,
      isLowStock: true,
      updatedAt: null,
    }))
  );

  return NextResponse.json({ inventory: [...inventory, ...missing] });
}

/** PATCH /api/restaurant/inventory { foodItemId, stockQty } — update stock + audit log. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(["RESTAURANT_ADMIN", "SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let body: { foodItemId?: unknown; stockQty?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const foodItemId = Number(body.foodItemId);
  const stockQty = Number(body.stockQty);
  if (!Number.isInteger(foodItemId) || foodItemId <= 0) {
    return NextResponse.json({ error: "foodItemId is required" }, { status: 400 });
  }
  if (!Number.isInteger(stockQty) || stockQty < 0) {
    return NextResponse.json(
      { error: "stockQty must be a non-negative integer" },
      { status: 400 }
    );
  }

  const food = await prisma.foodItem.findUnique({
    where: { id: foodItemId },
    select: { id: true, name: true, restaurant_id: true },
  });
  if (!food) {
    return NextResponse.json({ error: "Food item not found" }, { status: 404 });
  }
  if (session.role !== "SUPER_ADMIN") {
    const owned = await ownedRestaurantIds(session);
    if (!owned.includes(food.restaurant_id)) {
      return NextResponse.json(
        { error: "Food item does not belong to your restaurants" },
        { status: 403 }
      );
    }
  }

  const previous = await prisma.inventory.findUnique({
    where: { food_item_id: foodItemId },
    select: { stock_qty: true },
  });

  const updated = await prisma.inventory.upsert({
    where: { food_item_id: foodItemId },
    update: { stock_qty: stockQty },
    create: { food_item_id: foodItemId, stock_qty: stockQty, low_stock_at: 5 },
  });

  await audit(
    session.id,
    "INVENTORY_UPDATE",
    "inventory",
    updated.id,
    `Stock for "${food.name}" (food_item ${foodItemId}) changed from ${previous?.stock_qty ?? 0} to ${stockQty}`
  );

  return NextResponse.json({
    id: updated.id,
    foodItemId,
    foodName: food.name,
    stockQty: updated.stock_qty,
    lowStockAt: updated.low_stock_at,
    isLowStock: updated.stock_qty <= updated.low_stock_at,
  });
}
