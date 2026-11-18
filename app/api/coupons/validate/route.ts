import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { computeCouponDiscount } from "@/lib/utils";
import { couponValidateSchema } from "@/validations";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { code, subtotal } = parsed.data;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!coupon || !coupon.is_active) {
    return err("Coupon is invalid or inactive", 400);
  }
  const now = new Date();
  if (coupon.valid_from > now || (coupon.valid_to && coupon.valid_to < now)) {
    return err("Coupon is not valid at this time", 400);
  }
  if (subtotal < Number(coupon.min_order)) {
    return err(
      `Coupon requires a minimum order of ₹${Number(coupon.min_order)}`,
      400,
    );
  }
  const alreadyUsed = await prisma.couponUsage.findFirst({
    where: { coupon_id: coupon.id, user_id: session.id },
  });
  if (alreadyUsed) {
    return err("You have already used this coupon", 400);
  }

  const discount = computeCouponDiscount(
    subtotal,
    Number(coupon.discount_percent),
    Number(coupon.max_discount),
  );
  return json({
    valid: true,
    code: coupon.code,
    discountPercent: Number(coupon.discount_percent),
    discount,
    minOrder: Number(coupon.min_order),
  });
}
