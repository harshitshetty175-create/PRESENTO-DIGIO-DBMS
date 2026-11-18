import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, serializeRows } from "../../_helpers";

const ORDER_INCLUDE = {
  restaurant: {
    select: { id: true, name: true, address: true, city: true, phone: true },
  },
  user: { select: { id: true, name: true, phone: true } },
  address: {
    select: { line1: true, line2: true, city: true, pincode: true },
  },
  items: {
    select: { item_name: true, qty: true, unit_price: true, line_total: true },
  },
} as const;

/**
 * GET /api/delivery/assigned — deliveries assigned to the caller, plus
 * unassigned work available for pickup. Returns { partner, assigned, available, history }.
 */
export async function GET() {
  const auth = await requireAuth(["DELIVERY_PARTNER", "SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  const partner = await prisma.deliveryPartner.findUnique({
    where: { user_id: session.id },
  });
  if (!partner) {
    return NextResponse.json({
      partner: null,
      assigned: [],
      available: [],
      history: [],
    });
  }

  const [assigned, history, unassignedDeliveries, readyOrders] =
    await Promise.all([
      prisma.delivery.findMany({
        where: {
          partner_id: partner.id,
          status: { in: ["ASSIGNED", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        },
        include: { order: { include: ORDER_INCLUDE } },
        orderBy: { assigned_at: "desc" },
      }),
      prisma.delivery.findMany({
        where: {
          partner_id: partner.id,
          status: { in: ["DELIVERED", "CANCELLED"] },
        },
        include: { order: { include: ORDER_INCLUDE } },
        orderBy: { assigned_at: "desc" },
        take: 20,
      }),
      prisma.delivery.findMany({
        where: { partner_id: null, status: "ASSIGNED" },
        include: { order: { include: ORDER_INCLUDE } },
        orderBy: { assigned_at: "desc" },
        take: 20,
      }),
      prisma.order.findMany({
        where: {
          status: "READY_FOR_PICKUP",
          deliveries: { none: {} },
        },
        include: ORDER_INCLUDE,
        orderBy: { placed_at: "desc" },
        take: 20,
      }),
    ]);

  const available = [
    ...serializeRows(
      unassignedDeliveries.map((d) => ({
        deliveryId: d.id,
        orderId: d.order_id,
        status: d.status,
        assignedAt: d.assigned_at,
        order: d.order,
      }))
    ),
    ...serializeRows(
      readyOrders.map((o) => ({
        deliveryId: null,
        orderId: o.id,
        status: "READY_FOR_PICKUP",
        assignedAt: null,
        order: o,
      }))
    ),
  ];

  return NextResponse.json({
    partner: serializeRows([partner])[0],
    assigned: serializeRows(assigned),
    available,
    history: serializeRows(history),
  });
}

/**
 * POST /api/delivery/assigned { orderId } — partner claims an unassigned
 * delivery: creates/updates the Delivery with partner_id, status ACCEPTED,
 * accepted_at. Creates the partner profile on first use.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(["DELIVERY_PARTNER"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const orderId = Number(body.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, user_id: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "REJECTED") {
    return NextResponse.json(
      { error: `Order is already ${order.status}` },
      { status: 409 }
    );
  }

  const partner = await prisma.deliveryPartner.upsert({
    where: { user_id: session.id },
    update: {},
    create: {
      user_id: session.id,
      vehicle_type: "Bike",
      is_available: true,
      is_active: true,
    },
  });

  const existing = await prisma.delivery.findFirst({
    where: { order_id: orderId },
    orderBy: { id: "desc" },
  });
  if (existing && existing.partner_id !== null && existing.partner_id !== partner.id) {
    return NextResponse.json(
      { error: "This delivery is already claimed by another partner" },
      { status: 409 }
    );
  }

  const now = new Date();
  const delivery = existing
    ? await prisma.delivery.update({
        where: { id: existing.id },
        data: {
          partner_id: partner.id,
          status: "ACCEPTED",
          accepted_at: existing.accepted_at ?? now,
        },
      })
    : await prisma.delivery.create({
        data: {
          order_id: orderId,
          partner_id: partner.id,
          status: "ACCEPTED",
          accepted_at: now,
        },
      });

  try {
    await prisma.notification.create({
      data: {
        user_id: order.user_id,
        title: "Delivery partner assigned",
        body: `A delivery partner accepted your order #${orderId} and is on the way to the restaurant.`,
        type: "DELIVERY",
      },
    });
  } catch {
    // Notification failure must not fail the claim.
  }

  return NextResponse.json(serializeRows([delivery])[0], { status: 201 });
}
