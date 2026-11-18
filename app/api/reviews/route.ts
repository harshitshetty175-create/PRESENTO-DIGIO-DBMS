import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { reviewSchema } from "@/validations";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const restaurantId = sp.get("restaurantId");
  const foodItemId = sp.get("foodItemId");
  const mine = sp.get("mine") === "true";
  if (!restaurantId && !foodItemId && !mine) {
    return err("Provide restaurantId, foodItemId or mine=true", 400);
  }
  let mineUserId: number | null = null;
  if (mine) {
    const session = await getSession();
    if (!session) return err("Unauthorized", 401);
    mineUserId = session.id;
  }
  const reviews = await prisma.review.findMany({
    where: {
      ...(restaurantId ? { restaurant_id: Number(restaurantId) } : {}),
      ...(foodItemId ? { food_item_id: Number(foodItemId) } : {}),
      ...(mineUserId !== null ? { user_id: mineUserId } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { created_at: "desc" },
    take: 50,
  });
  return json({ reviews });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (session.role !== "CUSTOMER") {
    return err("Only customers can write reviews", 403);
  }

  const body = await parseBody(req);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { restaurantId, foodItemId, orderId, rating, comment } = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) return err("Restaurant not found", 404);

  if (foodItemId) {
    const food = await prisma.foodItem.findUnique({ where: { id: foodItemId } });
    if (!food) return err("Food item not found", 404);
    if (food.restaurant_id !== restaurantId) {
      return err("Food item does not belong to this restaurant", 400);
    }
  }

  // A review requires a delivered order for this restaurant.
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.user_id !== session.id) {
      return err("Order not found", 404);
    }
    if (order.restaurant_id !== restaurantId) {
      return err("Order is not for this restaurant", 400);
    }
    if (order.status !== "DELIVERED") {
      return err("You can only review a delivered order", 400);
    }
  } else {
    const delivered = await prisma.order.findFirst({
      where: {
        user_id: session.id,
        restaurant_id: restaurantId,
        status: "DELIVERED",
      },
    });
    if (!delivered) {
      return err("You can only review a restaurant after a delivered order", 403);
    }
  }

  const review = await prisma.review.create({
    data: {
      user_id: session.id,
      restaurant_id: restaurantId,
      food_item_id: foodItemId ?? null,
      order_id: orderId ?? null,
      rating,
      comment: comment ?? null,
    },
  });

  // Recompute average ratings after insert.
  const restaurantAvg = await prisma.review.aggregate({
    where: { restaurant_id: restaurantId },
    _avg: { rating: true },
  });
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { rating: Number((restaurantAvg._avg.rating ?? 0).toFixed(2)) },
  });
  if (foodItemId) {
    const foodAvg = await prisma.review.aggregate({
      where: { food_item_id: foodItemId },
      _avg: { rating: true },
    });
    await prisma.foodItem.update({
      where: { id: foodItemId },
      data: { rating: Number((foodAvg._avg.rating ?? 0).toFixed(2)) },
    });
  }

  return json({ review }, 201);
}
