import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { restaurantSchema } from "@/validations";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const cuisine = sp.get("cuisine")?.trim();
  const city = sp.get("city")?.trim();
  const sort = sp.get("sort"); // rating | delivery_mins | price
  const minRating = sp.get("minRating");
  const minRatingNum = minRating ? Number(minRating) : null;
  // Admins may list deactivated restaurants (to re-activate them);
  // public discovery always sees active restaurants only.
  const session = await getSession();
  const includeInactive =
    sp.get("includeInactive") === "1" && session?.role === "SUPER_ADMIN";

  const restaurants = await prisma.restaurant.findMany({
    where: {
      ...(includeInactive ? {} : { is_active: true }),
      ...(q ? { name: { contains: q } } : {}),
      ...(cuisine ? { cuisine: { contains: cuisine } } : {}),
      ...(city ? { city: { contains: city } } : {}),
    },
    include: {
      _count: { select: { food_items: true } },
      reviews: { select: { rating: true } },
    },
    orderBy:
      sort === "delivery_mins"
        ? { delivery_mins: "asc" }
        : sort === "price"
          ? { delivery_fee: "asc" }
          : { rating: "desc" },
  });

  // Average review rating computed in JS from the loaded reviews.
  const result = restaurants
    .map((r) => {
      const avgRating =
        r.reviews.length > 0
          ? r.reviews.reduce((sum, rev) => sum + rev.rating, 0) / r.reviews.length
          : Number(r.rating);
      const { reviews: _reviews, ...rest } = r;
      return { ...rest, avgRating: Math.round(avgRating * 100) / 100 };
    })
    .filter(
      (r) => minRatingNum === null || Number.isNaN(minRatingNum) || r.avgRating >= minRatingNum,
    );

  return json({ restaurants: result });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (session.role !== "RESTAURANT_ADMIN" && session.role !== "SUPER_ADMIN") {
    return err("Only restaurant admins can create restaurants", 403);
  }

  const body = await parseBody(req);
  const parsed = restaurantSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  const restaurant = await prisma.restaurant.create({
    data: {
      owner_id: session.id,
      name: d.name,
      description: d.description ?? null,
      cuisine: d.cuisine,
      address: d.address,
      city: d.city,
      phone: d.phone ?? null,
      image_url: d.image_url ?? null,
      delivery_fee: d.delivery_fee ?? 29,
      min_order: d.min_order ?? 0,
      delivery_mins: d.delivery_mins ?? 35,
      admins: { create: { user_id: session.id } },
    },
  });
  await audit(session.id, "RESTAURANT_CREATE", "restaurants", restaurant.id, {
    name: restaurant.name,
  });
  return json({ restaurant }, 201);
}
