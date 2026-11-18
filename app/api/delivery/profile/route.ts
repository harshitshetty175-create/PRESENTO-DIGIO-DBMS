import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, serializeRows } from "../../_helpers";

/** GET /api/delivery/profile — the caller's delivery-partner profile (or null). */
export async function GET() {
  const auth = await requireAuth(["DELIVERY_PARTNER", "SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  const partner = await prisma.deliveryPartner.findUnique({
    where: { user_id: session.id },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
  if (!partner) return NextResponse.json({ partner: null });
  return NextResponse.json({ partner: serializeRows([partner])[0] });
}

/**
 * PATCH /api/delivery/profile { is_available, vehicle_type?, vehicle_no? }
 * Availability toggle for the delivery dashboard (creates the profile on first use).
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(["DELIVERY_PARTNER"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let body: {
    is_available?: unknown;
    vehicle_type?: unknown;
    vehicle_no?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: {
    is_available?: boolean;
    vehicle_type?: string;
    vehicle_no?: string | null;
  } = {};
  if (typeof body.is_available === "boolean") data.is_available = body.is_available;
  if (typeof body.vehicle_type === "string" && body.vehicle_type.trim()) {
    data.vehicle_type = body.vehicle_type.trim().slice(0, 40);
  }
  if (typeof body.vehicle_no === "string") {
    data.vehicle_no = body.vehicle_no.trim().slice(0, 20) || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update (send is_available, vehicle_type or vehicle_no)" },
      { status: 400 }
    );
  }

  const partner = await prisma.deliveryPartner.upsert({
    where: { user_id: session.id },
    update: data,
    create: {
      user_id: session.id,
      vehicle_type: data.vehicle_type ?? "Bike",
      vehicle_no: data.vehicle_no ?? null,
      is_available: data.is_available ?? true,
      is_active: true,
    },
  });

  return NextResponse.json({ partner: serializeRows([partner])[0] });
}
