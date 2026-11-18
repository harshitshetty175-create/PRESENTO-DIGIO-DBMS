/**
 * checkout-math.test.js — RULE-MIRROR unit tests for checkout money math.
 *
 * Self-contained mirror of `calcTotals` in lib/utils.ts plus the coupon
 * cap / minimum-order gating used at checkout. Plain `node --test`, no
 * imports from TS files. If lib/utils.ts changes, update this mirror.
 *
 * Rules mirrored (lib/utils.ts calcTotals):
 *   discount = round2(subtotal * discountPercent / 100)
 *   taxable  = max(0, subtotal - discount)      // tax on DISCOUNTED subtotal
 *   tax      = round2(taxable * 0.05)            // 5% GST
 *   total    = round2(taxable + deliveryFee + tax)
 *
 * Coupon rules (as seeded in prisma/seed.ts and validated at checkout):
 *   - A coupon applies only when subtotal >= coupon.min_order.
 *   - discount = min(subtotal * discount_percent / 100, coupon.max_discount).
 *   - FREEDEL is implemented as 10% off, max Rs.40, min order Rs.99.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// --- Begin mirror of lib/utils.ts calcTotals (transcribed) -----------------
const TAX_RATE = 0.05;
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function calcTotals(subtotal, deliveryFee, discountPercent = 0) {
  const cleanSubtotal = round2(subtotal);
  const cleanDeliveryFee = round2(deliveryFee);
  const discount = round2((cleanSubtotal * discountPercent) / 100);
  const taxable = Math.max(0, cleanSubtotal - discount);
  const tax = round2(taxable * TAX_RATE);
  const total = round2(taxable + cleanDeliveryFee + tax);
  return { subtotal: cleanSubtotal, deliveryFee: cleanDeliveryFee, discount, tax, total };
}
// Coupon application: min-order gate + percentage capped at max_discount.
function applyCoupon(subtotal, coupon) {
  if (!coupon || subtotal < coupon.minOrder) return 0;
  return round2(Math.min((subtotal * coupon.discountPercent) / 100, coupon.maxDiscount));
}
// --- End mirror -----------------------------------------------------------

const COUPONS = {
  WELCOME20: { discountPercent: 20, maxDiscount: 100, minOrder: 199 },
  FOODFLOW50: { discountPercent: 50, maxDiscount: 150, minOrder: 499 },
  FREEDEL: { discountPercent: 10, maxDiscount: 40, minOrder: 99 },
  VEG10: { discountPercent: 10, maxDiscount: 80, minOrder: 149 },
};

describe("checkout math (rule mirror of lib/utils.ts calcTotals)", () => {
  it("computes subtotal + 5% tax + delivery with no coupon", () => {
    // subtotal 500, delivery 29: tax 25, total 554.
    const t = calcTotals(500, 29);
    assert.deepEqual(t, { subtotal: 500, deliveryFee: 29, discount: 0, tax: 25, total: 554 });
  });

  it("charges tax on the discounted subtotal, not the full subtotal", () => {
    // subtotal 400, 20% off = 80 discount, taxable 320, tax 16, total 320+29+16.
    const t = calcTotals(400, 29, 20);
    assert.equal(t.discount, 80);
    assert.equal(t.tax, 16);
    assert.equal(t.total, 365);
  });

  it("rounds to two decimals", () => {
    const t = calcTotals(333, 29);
    assert.equal(t.tax, 16.65);
    assert.equal(t.total, 378.65);
  });

  it("never taxes a negative amount when the discount exceeds the subtotal", () => {
    const t = calcTotals(50, 29, 200);
    assert.equal(t.tax, 0);
    assert.equal(t.total, 29);
  });

  it("supports free delivery (delivery fee 0)", () => {
    const t = calcTotals(299, 0);
    assert.equal(t.total, 313.95);
  });
});

describe("coupon cap and minimum-order math", () => {
  it("WELCOME20: 20% of 600 is 120 but capped at Rs.100", () => {
    assert.equal(applyCoupon(600, COUPONS.WELCOME20), 100);
  });

  it("WELCOME20: 20% of 400 is 80, under the cap", () => {
    assert.equal(applyCoupon(400, COUPONS.WELCOME20), 80);
  });

  it("WELCOME20: no discount below the Rs.199 minimum", () => {
    assert.equal(applyCoupon(150, COUPONS.WELCOME20), 0);
  });

  it("FOODFLOW50: 50% of 800 is 400 but capped at Rs.150", () => {
    assert.equal(applyCoupon(800, COUPONS.FOODFLOW50), 150);
  });

  it("FOODFLOW50: no discount below the Rs.499 minimum", () => {
    assert.equal(applyCoupon(450, COUPONS.FOODFLOW50), 0);
  });

  it("FREEDEL: 10% of 500 is 50 but capped at Rs.40", () => {
    assert.equal(applyCoupon(500, COUPONS.FREEDEL), 40);
  });

  it("VEG10: 10% of 500 is 50, under the Rs.80 cap", () => {
    assert.equal(applyCoupon(500, COUPONS.VEG10), 50);
  });

  it("VEG10: 10% of 1000 is 100 but capped at Rs.80", () => {
    assert.equal(applyCoupon(1000, COUPONS.VEG10), 80);
  });

  it("end-to-end: subtotal 600, WELCOME20, delivery 29", () => {
    // discount capped at 100 -> taxable 500 -> tax 25 -> total 554.
    const discount = applyCoupon(600, COUPONS.WELCOME20);
    const t = calcTotals(600, 29, (discount / 600) * 100);
    assert.equal(t.discount, 100);
    assert.equal(t.tax, 25);
    assert.equal(t.total, 554);
  });
});
