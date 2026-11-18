import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  ownedRestaurantIds,
  pageParams,
  serializeRows,
} from "../../_helpers";

/** GET /api/restaurant/orders?status=&page= — orders for the caller's own restaurants. */
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

  const { page, limit, skip } = pageParams(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get("status");

  const where = {
    restaurant_id: { in: restaurantIds },
    ...(status
      ? {
          status: status as
            | "PLACED"
            | "CONFIRMED"
            | "PREPARING"
            | "READY_FOR_PICKUP"
            | "PICKED_UP"
            | "OUT_FOR_DELIVERY"
            | "DELIVERED"
            | "CANCELLED"
            | "REJECTED",
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        restaurant: { select: { id: true, name: true } },
        address: {
          select: { line1: true, line2: true, city: true, pincode: true },
        },
        items: {
          select: {
            id: true,
            item_name: true,
            qty: true,
            unit_price: true,
            line_total: true,
          },
        },
      },
      orderBy: { placed_at: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    orders: serializeRows(orders),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}
