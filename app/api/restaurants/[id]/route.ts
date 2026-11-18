import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { restaurantPatchSchema } from "@/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId)) return err("Invalid restaurant id", 400);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      food_items: {
        include: { category: true, inventory: true },
        orderBy: [{ category_id: "asc" }, { name: "asc" }],
      },
      reviews: {
        take: 10,
        orderBy: { created_at: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!restaurant) return err("Restaurant not found", 404);

  // Group food items by category (JS grouping, keeps one query).
  const categories: Array<{
    category: { id: number; name: string; slug: string };
    items: typeof restaurant.food_items;
  }> = [];
  const byCategory = new Map<number, (typeof categories)[number]>();
  for (const item of restaurant.food_items) {
    let group = byCategory.get(item.category_id);
    if (!group) {
      group = {
        category: {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
        },
        items: [],
      };
      byCategory.set(item.category_id, group);
      categories.push(group);
    }
    group.items.push(item);
  }

  const { food_items: _foodItems, ...rest } = restaurant;
  return json({ restaurant: rest, categories });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { id } = await params;
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId)) return err("Invalid restaurant id", 400);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { admins: { select: { user_id: true } } },
  });
  if (!restaurant) return err("Restaurant not found", 404);

  const isOwner = restaurant.owner_id === session.id;
  const isLinkedAdmin = restaurant.admins.some((a) => a.user_id === session.id);
  if (session.role !== "SUPER_ADMIN" && !isOwner && !isLinkedAdmin) {
    return err("Only the restaurant owner or a super admin can edit it", 403);
  }

  const body = await parseBody(req);
  const parsed = restaurantPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  // Only SUPER_ADMIN may toggle is_active; owners/admins may toggle is_open.
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.description !== undefined) data.description = d.description;
  if (d.cuisine !== undefined) data.cuisine = d.cuisine;
  if (d.address !== undefined) data.address = d.address;
  if (d.city !== undefined) data.city = d.city;
  if (d.phone !== undefined) data.phone = d.phone;
  if (d.image_url !== undefined) data.image_url = d.image_url;
  if (d.delivery_fee !== undefined) data.delivery_fee = d.delivery_fee;
  if (d.min_order !== undefined) data.min_order = d.min_order;
  if (d.delivery_mins !== undefined) data.delivery_mins = d.delivery_mins;
  if (d.is_open !== undefined) data.is_open = d.is_open;
  if (d.is_active !== undefined && session.role === "SUPER_ADMIN") {
    data.is_active = d.is_active;
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data,
  });
  await audit(session.id, "RESTAURANT_UPDATE", "restaurants", restaurantId, data);
  return json({ restaurant: updated });
}
