import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, num } from "../../_helpers";

const REPORT_TYPES = [
  "daily-orders",
  "restaurant-sales",
  "popular-foods",
  "payment-summary",
  "monthly-revenue",
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

/**
 * GET /api/lab/reports?type=&from=&to= — real Prisma aggregations.
 * from/to are ISO dates (inclusive); defaults: last 30 days for daily
 * reports, last 6 months for monthly revenue.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") ?? "daily-orders") as ReportType;
  if (!REPORT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Unknown report type. Allowed: ${REPORT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  let to = toParam ? new Date(toParam) : null;
  if (to) to.setHours(23, 59, 59, 999);
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
  }
  const range =
    from || to
      ? { gte: from ?? undefined, lte: to ?? undefined }
      : undefined;

  let rows: unknown[] = [];

  if (type === "daily-orders") {
    const start = from ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const orders = await prisma.order.findMany({
      where: { placed_at: range ?? { gte: start } },
      select: { placed_at: true, total_amount: true, status: true },
    });
    const byDay = new Map<string, { orders: number; revenue: number; delivered: number }>();
    for (const o of orders) {
      const key = o.placed_at.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { orders: 0, revenue: 0, delivered: 0 };
      cur.orders += 1;
      cur.revenue += num(o.total_amount);
      if (o.status === "DELIVERED") cur.delivered += 1;
      byDay.set(key, cur);
    }
    rows = [...byDay.entries()]
      .map(([date, v]) => ({
        date,
        orders: v.orders,
        delivered: v.delivered,
        revenue: Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } else if (type === "restaurant-sales") {
    const groups = await prisma.order.groupBy({
      by: ["restaurant_id"],
      where: range ? { placed_at: range } : undefined,
      _count: { _all: true },
      _sum: { total_amount: true },
    });
    const names = await prisma.restaurant.findMany({
      where: { id: { in: groups.map((g) => g.restaurant_id) } },
      select: { id: true, name: true, city: true },
    });
    const byId = new Map(names.map((r) => [r.id, r]));
    rows = groups
      .map((g) => ({
        restaurantId: g.restaurant_id,
        restaurant: byId.get(g.restaurant_id)?.name ?? `#${g.restaurant_id}`,
        city: byId.get(g.restaurant_id)?.city ?? "",
        orders: g._count._all,
        revenue: Math.round(num(g._sum.total_amount) * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  } else if (type === "popular-foods") {
    const groups = await prisma.orderItem.groupBy({
      by: ["food_item_id", "item_name"],
      where: range ? { order: { placed_at: range } } : undefined,
      _sum: { qty: true, line_total: true },
      _count: { _all: true },
    });
    rows = groups
      .map((g) => ({
        foodItemId: g.food_item_id,
        item: g.item_name,
        timesOrdered: g._count._all,
        qtySold: g._sum.qty ?? 0,
        revenue: Math.round(num(g._sum.line_total) * 100) / 100,
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 20);
  } else if (type === "payment-summary") {
    const groups = await prisma.payment.groupBy({
      by: ["status", "method"],
      where: range ? { created_at: range } : undefined,
      _count: { _all: true },
      _sum: { amount: true },
    });
    rows = groups
      .map((g) => ({
        status: g.status,
        method: g.method,
        payments: g._count._all,
        total: Math.round(num(g._sum.amount) * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  } else if (type === "monthly-revenue") {
    const start =
      from ?? new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
    const orders = await prisma.order.findMany({
      where: { placed_at: range ?? { gte: start } },
      select: { placed_at: true, total_amount: true, status: true },
    });
    const byMonth = new Map<string, { orders: number; revenue: number; delivered: number }>();
    for (const o of orders) {
      const key = o.placed_at.toISOString().slice(0, 7);
      const cur = byMonth.get(key) ?? { orders: 0, revenue: 0, delivered: 0 };
      cur.orders += 1;
      cur.revenue += num(o.total_amount);
      if (o.status === "DELIVERED") cur.delivered += 1;
      byMonth.set(key, cur);
    }
    rows = [...byMonth.entries()]
      .map(([month, v]) => ({
        month,
        orders: v.orders,
        delivered: v.delivered,
        revenue: Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  return NextResponse.json({
    type,
    from: from ? from.toISOString().slice(0, 10) : null,
    to: to ? to.toISOString().slice(0, 10) : null,
    rows,
  });
}
