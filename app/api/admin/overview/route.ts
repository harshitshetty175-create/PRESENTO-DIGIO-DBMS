import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, num } from "../../_helpers";

/** GET /api/admin/overview — platform-wide counts, revenue and distributions. */
export async function GET() {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;

  const now = new Date();
  const since14 = new Date(now);
  since14.setDate(now.getDate() - 13);
  since14.setHours(0, 0, 0, 0);
  const since6mo = new Date(now);
  since6mo.setMonth(now.getMonth() - 5, 1);
  since6mo.setHours(0, 0, 0, 0);

  const [
    customers,
    restaurants,
    partners,
    foodItems,
    totalOrders,
    statusGroups,
    grossAgg,
    paymentsAgg,
    successfulPayments,
    recentOrders,
    monthlyOrders,
    topGroups,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.restaurant.count(),
    prisma.deliveryPartner.count(),
    prisma.foodItem.count(),
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({ _sum: { total_amount: true } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: "SUCCESS" } }),
    prisma.order.findMany({
      where: { placed_at: { gte: since14 } },
      select: { placed_at: true, total_amount: true, status: true },
    }),
    prisma.order.findMany({
      where: { placed_at: { gte: since6mo } },
      select: { placed_at: true, total_amount: true },
    }),
    prisma.order.groupBy({
      by: ["restaurant_id"],
      _count: { _all: true },
      _sum: { total_amount: true },
    }),
  ]);

  const countByStatus = new Map<string, number>();
  for (const g of statusGroups) countByStatus.set(g.status, g._count._all);
  const statusDistribution = [...countByStatus.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const dailyOrders: { date: string; orders: number; revenue: number }[] = [];
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const o of recentOrders) {
    const key = o.placed_at.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += num(o.total_amount);
    byDay.set(key, cur);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(since14);
    d.setDate(since14.getDate() + (13 - i));
    const key = d.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { orders: 0, revenue: 0 };
    dailyOrders.push({
      date: key,
      orders: cur.orders,
      revenue: Math.round(cur.revenue * 100) / 100,
    });
  }

  const monthlyRevenue: { month: string; revenue: number; orders: number }[] = [];
  const byMonth = new Map<string, { revenue: number; orders: number }>();
  for (const o of monthlyOrders) {
    const key = o.placed_at.toISOString().slice(0, 7);
    const cur = byMonth.get(key) ?? { revenue: 0, orders: 0 };
    cur.orders += 1;
    cur.revenue += num(o.total_amount);
    byMonth.set(key, cur);
  }
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { revenue: 0, orders: 0 };
    monthlyRevenue.push({
      month: key,
      revenue: Math.round(cur.revenue * 100) / 100,
      orders: cur.orders,
    });
  }

  const topRestaurantIds = topGroups
    .map((g) => ({
      restaurantId: g.restaurant_id,
      orders: g._count._all,
      revenue: num(g._sum.total_amount),
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);
  const topNames = await prisma.restaurant.findMany({
    where: { id: { in: topRestaurantIds.map((t) => t.restaurantId) } },
    select: { id: true, name: true, city: true },
  });
  const nameById = new Map(topNames.map((r) => [r.id, r]));
  const topRestaurants = topRestaurantIds.map((t) => ({
    ...t,
    revenue: Math.round(t.revenue * 100) / 100,
    name: nameById.get(t.restaurantId)?.name ?? `Restaurant #${t.restaurantId}`,
    city: nameById.get(t.restaurantId)?.city ?? "",
  }));

  return NextResponse.json({
    counts: { customers, restaurants, partners, foodItems, orders: totalOrders },
    completedOrders: countByStatus.get("DELIVERED") ?? 0,
    cancelledOrders:
      (countByStatus.get("CANCELLED") ?? 0) + (countByStatus.get("REJECTED") ?? 0),
    grossOrderValue: Math.round(num(grossAgg._sum.total_amount) * 100) / 100,
    successfulPayments: {
      count: successfulPayments,
      total: Math.round(num(paymentsAgg._sum.amount) * 100) / 100,
    },
    dailyOrders,
    monthlyRevenue,
    statusDistribution,
    topRestaurants,
  });
}
