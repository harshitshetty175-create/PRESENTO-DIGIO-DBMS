import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { couponSchema } from "@/validations";

/** Narrows an unknown thrown value to a Prisma known-request error. */
function isPrismaKnownError(e: unknown): e is { code: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function GET() {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      is_active: true,
      valid_from: { lte: now },
      OR: [{ valid_to: null }, { valid_to: { gte: now } }],
    },
    orderBy: { created_at: "desc" },
  });
  return json({ coupons });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (session.role !== "SUPER_ADMIN") {
    return err("Only super admins can create coupons", 403);
  }

  const body = await parseBody(req);
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: d.code,
        description: d.description ?? null,
        discount_percent: d.discount_percent,
        max_discount: d.max_discount,
        min_order: d.min_order,
        is_active: d.is_active ?? true,
        valid_from: d.valid_from ? new Date(d.valid_from) : new Date(),
        valid_to: d.valid_to ? new Date(d.valid_to) : null,
      },
    });
    return json({ coupon }, 201);
  } catch (e) {
    if (isPrismaKnownError(e) && e.code === "P2002") {
      return err("A coupon with this code already exists", 409);
    }
    throw e;
  }
}
