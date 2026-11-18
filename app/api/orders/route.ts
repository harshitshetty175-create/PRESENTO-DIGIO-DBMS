import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err } from "@/lib/http";

const ORDER_INCLUDE = {
  items: { include: { food_item: { select: { id: true, name: true } } } },
  payments: true,
  restaurant: { select: { id: true, name: true, city: true } },
  address: true,
  user: { select: { id: true, name: true, email: true } },
  status_history: { orderBy: { created_at: "asc" as const } },
} as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? "10") || 10));

  let where: Record<string, unknown> = {};
  if (session.role === "CUSTOMER") {
    where = { user_id: session.id };
  } else if (session.role === "RESTAURANT_ADMIN") {
    const restaurants = await prisma.restaurant.findMany({
      where: {
        OR: [
          { owner_id: session.id },
          { admins: { some: { user_id: session.id } } },
        ],
      },
      select: { id: true },
    });
    where = { restaurant_id: { in: restaurants.map((r) => r.id) } };
  } else if (session.role === "DELIVERY_PARTNER") {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { user_id: session.id },
      include: { deliveries: { select: { order_id: true } } },
    });
    where = { id: { in: partner?.deliveries.map((d) => d.order_id) ?? [] } };
  }
  // SUPER_ADMIN: all orders (no extra filter).
  if (status) where = { ...where, status };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { placed_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return json({ orders, page, limit, total, totalPages: Math.ceil(total / limit) });
}
