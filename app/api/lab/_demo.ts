import { prisma } from "@/lib/prisma";

export const DEMO_RESTAURANT_NAME = "DBMS Lab Demo Restaurant";
export const DEMO_CATEGORY_NAME = "DBMS Lab Demo";
export const DEMO_CATEGORY_SLUG = "dbms-lab-demo";
export const DEMO_FOOD_NAME = "DBMS Lab Demo Item";

/**
 * Demo-data helpers for the DBMS Lab. The lab's transaction / concurrency
 * demos must never touch real orders, so they operate on clearly labelled
 * demo rows created on demand here. The demo restaurant is owned by the
 * first restaurant-admin / super-admin user found (a restaurant requires an
 * owner_id); if no user exists at all the caller gets a clear 400.
 */
export async function ensureDemoOwnerId(): Promise<number> {
  const owner = await prisma.user.findFirst({
    where: { role: { in: ["RESTAURANT_ADMIN", "SUPER_ADMIN"] } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (owner) return owner.id;
  const anyUser = await prisma.user.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!anyUser) {
    throw new Error(
      "No users exist yet — seed a user (e.g. a restaurant admin) before running the DBMS Lab demos."
    );
  }
  return anyUser.id;
}

export async function ensureDemoRestaurant() {
  const existing = await prisma.restaurant.findFirst({
    where: { name: DEMO_RESTAURANT_NAME },
  });
  if (existing) return existing;
  const ownerId = await ensureDemoOwnerId();
  return prisma.restaurant.create({
    data: {
      owner_id: ownerId,
      name: DEMO_RESTAURANT_NAME,
      description:
        "Demo restaurant created by the DBMS Lab for transaction / concurrency simulations. Not a real restaurant.",
      cuisine: "Demo",
      address: "DBMS Lab (demo only)",
      city: "Lab",
      is_open: false,
      is_active: false,
    },
  });
}

export async function ensureDemoCategory() {
  const existing = await prisma.category.findFirst({
    where: { slug: DEMO_CATEGORY_SLUG },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: { name: DEMO_CATEGORY_NAME, slug: DEMO_CATEGORY_SLUG },
  });
}

export async function ensureDemoFood(name: string) {
  const existing = await prisma.foodItem.findFirst({
    where: { name },
    include: { inventory: true },
  });
  if (existing) return existing;
  const [restaurant, category] = await Promise.all([
    ensureDemoRestaurant(),
    ensureDemoCategory(),
  ]);
  return prisma.foodItem.create({
    data: {
      restaurant_id: restaurant.id,
      category_id: category.id,
      name,
      description:
        "Demo item for DBMS Lab simulations (transactions / concurrency). Not for sale.",
      price: 99,
      veg_type: "VEG",
      is_available: false,
    },
    include: { inventory: true },
  });
}

/** Ensure the demo food item has an inventory row with at least `minStock` units. */
export async function ensureDemoInventory(foodItemId: number, minStock = 10) {
  const existing = await prisma.inventory.findUnique({
    where: { food_item_id: foodItemId },
  });
  if (!existing) {
    return prisma.inventory.create({
      data: { food_item_id: foodItemId, stock_qty: minStock, low_stock_at: 2 },
    });
  }
  if (existing.stock_qty < minStock) {
    return prisma.inventory.update({
      where: { food_item_id: foodItemId },
      data: { stock_qty: minStock },
    });
  }
  return existing;
}

export async function readStock(foodItemId: number): Promise<number> {
  const row = await prisma.inventory.findUnique({
    where: { food_item_id: foodItemId },
    select: { stock_qty: true },
  });
  return row?.stock_qty ?? 0;
}
