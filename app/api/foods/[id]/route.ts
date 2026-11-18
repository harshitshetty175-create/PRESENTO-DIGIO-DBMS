import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { foodPatchSchema } from "@/validations";

type Params = { params: Promise<{ id: string }> };

async function canManageFood(
  session: { id: number; role: string },
  foodId: number,
) {
  const food = await prisma.foodItem.findUnique({
    where: { id: foodId },
    include: {
      restaurant: {
        select: {
          owner_id: true,
          admins: { select: { user_id: true } },
        },
      },
    },
  });
  if (!food) return { food: null, allowed: false };
  const allowed =
    session.role === "SUPER_ADMIN" ||
    food.restaurant.owner_id === session.id ||
    food.restaurant.admins.some((a) => a.user_id === session.id);
  return { food, allowed };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { id } = await params;
  const foodId = Number(id);
  if (!Number.isInteger(foodId)) return err("Invalid food id", 400);

  const { food, allowed } = await canManageFood(session, foodId);
  if (!food) return err("Food item not found", 404);
  if (!allowed) return err("You do not manage this food item", 403);

  const body = await parseBody(req);
  const parsed = foodPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  const updated = await prisma.foodItem.update({
    where: { id: foodId },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      ...(d.image_url !== undefined ? { image_url: d.image_url } : {}),
      ...(d.veg_type !== undefined ? { veg_type: d.veg_type } : {}),
      ...(d.is_veg !== undefined ? { is_veg: d.is_veg } : {}),
      ...(d.is_available !== undefined ? { is_available: d.is_available } : {}),
      ...(d.category_id !== undefined ? { category_id: d.category_id } : {}),
    },
  });
  await audit(session.id, "FOOD_UPDATE", "food_items", foodId, d);
  return json({ food: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { id } = await params;
  const foodId = Number(id);
  if (!Number.isInteger(foodId)) return err("Invalid food id", 400);

  const { food, allowed } = await canManageFood(session, foodId);
  if (!food) return err("Food item not found", 404);
  if (!allowed) return err("You do not manage this food item", 403);

  const orderRefCount = await prisma.orderItem.count({
    where: { food_item_id: foodId },
  });
  if (orderRefCount > 0) {
    // Historical orders reference this item: deactivate instead of deleting.
    const deactivated = await prisma.foodItem.update({
      where: { id: foodId },
      data: { is_available: false },
    });
    await audit(session.id, "FOOD_DEACTIVATE", "food_items", foodId, {
      reason: "referenced by past orders",
    });
    return json({
      message:
        "Food item is referenced by past orders, so it was deactivated instead of deleted.",
      food: deactivated,
    });
  }

  await prisma.foodItem.delete({ where: { id: foodId } });
  await audit(session.id, "FOOD_DELETE", "food_items", foodId, null);
  return json({ ok: true, message: "Food item deleted." });
}
