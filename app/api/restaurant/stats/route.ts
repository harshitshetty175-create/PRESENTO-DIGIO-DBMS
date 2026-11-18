import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  ownedRestaurantIds,
  num,
  serializeValue,
} from "../../_helpers";

const ACTIVE_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
] as const;

/** GET /api/restaurant/stats — totals for the caller's own restaurants. */
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

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true, city: true, is_open: true },
  });

  if (restaurantIds.length === 0) {
    return NextResponse.json({
      restaurants: [],
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      revenue: 0,
      avgOrderValue: 0,
      popularItems: [],
      dailyRevenue: [],
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [totalOrders, statusGroups, revenueAgg, grossAgg, recentOrders, popular] =
    await Promise.all([
      prisma.order.count({ where: { restaurant_id: { in: restaurantIds } } }),
      prisma.order.groupBy({
        by: ["status"],
        where: { restaurant_id: { in: restaurantIds } },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          restaurant_id: { in: restaurantIds },
          status: "DELIVERED",
        },
        _sum: { total_amount: true },
      }),
      prisma.order.aggregate({
        where: { restaurant_id: { in: restaurantIds } },
        _sum: { total_amount: true },
      }),
      prisma.order.findMany({
        where: {
          restaurant_id: { in: restaurantIds },
          placed_at: { gte: since },
        },
        select: { placed_at: true, total_amount: true, status: true },
      }),
      prisma.orderItem.groupBy({
        by: ["food_item_id", "item_name"],
        where: { order: { restaurant_id: { in: restaurantIds } } },
        _sum: { qty: true, line_total: true },
      }),
    ]);

  const countByStatus = new Map<string, number>();
  for (const g of statusGroups) countByStatus.set(g.status, g._count._all);
  const pendingOrders = (ACTIVE_STATUSES as readonly string[]).reduce(
    (sum, s) => sum + (countByStatus.get(s) ?? 0),
    0
  );
  const completedOrders = countByStatus.get("DELIVERED") ?? 0;
  const cancelledOrders =
    (countByStatus.get("CANCELLED") ?? 0) + (countByStatus.get("REJECTED") ?? 0);

  const revenue = num(revenueAgg._sum.total_amount);
  const gross = num(grossAgg._sum.total_amount);
  const avgOrderValue = totalOrders > 0 ? gross / totalOrders : 0;

  // Daily revenue, last 14 days (zero-filled).
  const days: { date: string; revenue: number; orders: number }[] = [];
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of recentOrders) {
    const key = o.placed_at.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { revenue: 0, orders: 0 };
    cur.revenue += num(o.total_amount);
    cur.orders += 1;
    byDay.set(key, cur);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(since);
    d.setDate(since.getDate() + (13 - i));
    const key = d.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { revenue: 0, orders: 0 };
    days.push({ date: key, revenue: Math.round(cur.revenue * 100) / 100, orders: cur.orders });
  }

  const popularItems = popular
    .map((p) => ({
      foodItemId: p.food_item_id,
      name: p.item_name,
      qty: p._sum.qty ?? 0,
      revenue: num(p._sum.line_total),
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return NextResponse.json(
    serializeValue({
      restaurants,
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      revenue: Math.round(revenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      popularItems,
      dailyRevenue: days,
    }) as Record<string, unknown>
  );
}
