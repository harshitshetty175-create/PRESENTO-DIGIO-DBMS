import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, serializeRows } from "../../../_helpers";

const NEXT_STATUS: Record<
  string,
  { from: string; orderStatus: string | null; timestamp: string | null }
> = {
  ACCEPTED: { from: "ASSIGNED", orderStatus: null, timestamp: "accepted_at" },
  PICKED_UP: { from: "ACCEPTED", orderStatus: "PICKED_UP", timestamp: "picked_up_at" },
  OUT_FOR_DELIVERY: {
    from: "PICKED_UP",
    orderStatus: "OUT_FOR_DELIVERY",
    timestamp: null, // Delivery has no out_for_delivery_at column
  },
  DELIVERED: { from: "OUT_FOR_DELIVERY", orderStatus: "DELIVERED", timestamp: "delivered_at" },
};

/**
 * PATCH /api/delivery/[id]/status { status }
 * Validates ASSIGNED → ACCEPTED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED,
 * sets timestamps, and updates the Order status in the same transaction.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(["DELIVERY_PARTNER", "SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const deliveryId = Number(id);
  if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
    return NextResponse.json({ error: "Invalid delivery id" }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const status = String(body.status ?? "");
  const transition = NEXT_STATUS[status];
  if (!transition) {
    return NextResponse.json(
      {
        error:
          "Invalid status. Allowed: ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED",
      },
      { status: 400 }
    );
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: { select: { id: true, user_id: true, status: true } } },
  });
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (session.role === "DELIVERY_PARTNER") {
    const partner = await prisma.deliveryPartner.findUnique({
      where: { user_id: session.id },
      select: { id: true },
    });
    if (!partner || delivery.partner_id !== partner.id) {
      return NextResponse.json(
        { error: "This delivery is not assigned to you" },
        { status: 403 }
      );
    }
  }

  if (delivery.status !== transition.from) {
    return NextResponse.json(
      {
        error: `Cannot move delivery from ${delivery.status} to ${status}. Expected current status: ${transition.from}.`,
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const timestampPatch =
    transition.timestamp === "accepted_at"
      ? { accepted_at: now }
      : transition.timestamp === "picked_up_at"
        ? { picked_up_at: now }
        : transition.timestamp === "delivered_at"
          ? { delivered_at: now }
          : {};

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.delivery.update({
      where: { id: deliveryId },
      data: { status: status as "ACCEPTED" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED", ...timestampPatch },
    });
    if (transition.orderStatus) {
      const orderStatus = transition.orderStatus as
        | "PICKED_UP"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED";
      await tx.order.update({
        where: { id: delivery.order_id },
        data: { status: orderStatus },
      });
      await tx.orderStatusHistory.create({
        data: {
          order_id: delivery.order_id,
          old_status: delivery.order.status,
          new_status: orderStatus,
          changed_by: session.id,
        },
      });
    }
    return d;
  });

  const messages: Record<string, string> = {
    ACCEPTED: `Your order #${delivery.order_id} was accepted by the delivery partner.`,
    PICKED_UP: `Your order #${delivery.order_id} was picked up and is on its way.`,
    OUT_FOR_DELIVERY: `Your order #${delivery.order_id} is out for delivery.`,
    DELIVERED: `Your order #${delivery.order_id} was delivered. Enjoy your meal!`,
  };
  try {
    await prisma.notification.create({
      data: {
        user_id: delivery.order.user_id,
        title: `Order #${delivery.order_id} — ${status.replaceAll("_", " ")}`,
        body: messages[status] ?? `Your order #${delivery.order_id} status changed to ${status}.`,
        type: "DELIVERY",
      },
    });
  } catch {
    // Notification failure must not fail the status update.
  }

  return NextResponse.json({
    delivery: serializeRows([updated])[0],
    orderStatus: transition.orderStatus ?? delivery.order.status,
  });
}
