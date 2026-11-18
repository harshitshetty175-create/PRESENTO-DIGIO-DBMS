import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { foodSchema } from "@/validations";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const categoryId = sp.get("categoryId");
  const restaurantId = sp.get("restaurantId");
  const veg = sp.get("veg"); // "true" | "false"
  const vegType = sp.get("veg_type");
  const sort = sp.get("sort"); // price_asc | price_desc | rating
  const availableParam = sp.get("available"); // default: available only

  const foods = await prisma.foodItem.findMany({
    where: {
      ...(q ? { name: { contains: q } } : {}),
      ...(categoryId ? { category_id: Number(categoryId) } : {}),
      ...(restaurantId ? { restaurant_id: Number(restaurantId) } : {}),
      ...(veg === "true" ? { is_veg: true } : veg === "false" ? { is_veg: false } : {}),
      ...(vegType ? { veg_type: vegType as "VEG" | "NON_VEG" | "VEGAN" } : {}),
      ...(availableParam === "false" ? {} : { is_available: true }),
    },
    include: {
      category: true,
      restaurant: { select: { id: true, name: true, city: true, cuisine: true } },
      inventory: true,
    },
    orderBy:
      sort === "price_asc"
        ? { price: "asc" }
        : sort === "price_desc"
          ? { price: "desc" }
          : sort === "rating"
            ? { rating: "desc" }
            : { name: "asc" },
  });
  return json({ foods });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (session.role !== "RESTAURANT_ADMIN" && session.role !== "SUPER_ADMIN") {
    return err("Only restaurant admins can add food items", 403);
  }

  const body = await parseBody(req);
  const parsed = foodSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: d.restaurantId },
    include: { admins: { select: { user_id: true } } },
  });
  if (!restaurant) return err("Restaurant not found", 404);
  const isOwner = restaurant.owner_id === session.id;
  const isLinkedAdmin = restaurant.admins.some((a) => a.user_id === session.id);
  if (session.role !== "SUPER_ADMIN" && !isOwner && !isLinkedAdmin) {
    return err("You do not manage this restaurant", 403);
  }

  const category = await prisma.category.findUnique({ where: { id: d.categoryId } });
  if (!category) return err("Category not found", 404);

  const food = await prisma.foodItem.create({
    data: {
      restaurant_id: d.restaurantId,
      category_id: d.categoryId,
      name: d.name,
      description: d.description ?? null,
      price: d.price,
      image_url: d.image_url ?? null,
      veg_type: d.veg_type,
      is_veg: d.is_veg,
      inventory: { create: { stock_qty: d.stock_qty ?? 20 } },
    },
    include: { inventory: true, category: true },
  });
  await audit(session.id, "FOOD_CREATE", "food_items", food.id, {
    name: food.name,
    restaurant_id: d.restaurantId,
  });
  return json({ food }, 201);
}
