import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, audit, serializeRows } from "../../_helpers";

/**
 * GET /api/admin/coupons — list all coupons (admin view).
 * NOTE: app/api/coupons/route.ts does not exist in this repo, so the admin
 * coupons endpoint is created here as specified by the task.
 */
export async function GET() {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;

  const coupons = await prisma.coupon.findMany({
    include: { _count: { select: { usages: true } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json({ coupons: serializeRows(coupons) });
}

/** POST /api/admin/coupons — create a coupon (SUPER_ADMIN only). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let body: {
    code?: unknown;
    description?: unknown;
    discount_percent?: unknown;
    max_discount?: unknown;
    min_order?: unknown;
    valid_from?: unknown;
    valid_to?: unknown;
    is_active?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code || code.length > 40) {
    return NextResponse.json(
      { error: "code is required (max 40 characters)" },
      { status: 400 }
    );
  }
  const discountPercent = Number(body.discount_percent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return NextResponse.json(
      { error: "discount_percent must be between 0 and 100" },
      { status: 400 }
    );
  }
  const maxDiscount = Number(body.max_discount ?? 0);
  const minOrder = Number(body.min_order ?? 0);
  if (maxDiscount < 0 || minOrder < 0) {
    return NextResponse.json(
      { error: "max_discount and min_order must be >= 0" },
      { status: 400 }
    );
  }
  const validFrom =
    typeof body.valid_from === "string" && body.valid_from
      ? new Date(body.valid_from)
      : new Date();
  const validTo =
    typeof body.valid_to === "string" && body.valid_to
      ? new Date(body.valid_to)
      : null;
  if (Number.isNaN(validFrom.getTime()) || (validTo && Number.isNaN(validTo.getTime()))) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code,
        description:
          typeof body.description === "string"
            ? body.description.slice(0, 200) || null
            : null,
        discount_percent: discountPercent,
        max_discount: maxDiscount,
        min_order: minOrder,
        is_active:
          typeof body.is_active === "boolean" ? body.is_active : true,
        valid_from: validFrom,
        valid_to: validTo,
      },
    });
    await audit(session.id, "COUPON_CREATED", "coupons", coupon.id, `Code ${code}`);
    return NextResponse.json({ coupon: serializeRows([coupon])[0] }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: `Coupon code "${code}" already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not create coupon" },
      { status: 500 }
    );
  }
}
