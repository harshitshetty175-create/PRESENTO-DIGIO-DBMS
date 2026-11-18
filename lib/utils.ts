import type { OrderStatus } from "@/types";

/** Join class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(n);
}

export const TAX_RATE = 0.05;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Shared coupon math: pct discount, capped by max_discount (0 = no cap). */
export function computeCouponDiscount(
  subtotal: number,
  discountPercent: number,
  maxDiscount: number,
): number {
  const raw = round2((subtotal * discountPercent) / 100);
  return maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw;
}

export interface Totals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Server-side totals. `discountPercent` is a percentage of the subtotal
 * (0 when no coupon). Tax (5%) applies to the discounted subtotal.
 */
export function calcTotals(
  subtotal: number,
  deliveryFee: number,
  discountPercent = 0,
): Totals {
  const cleanSubtotal = round2(subtotal);
  const cleanDeliveryFee = round2(deliveryFee);
  const discount = round2((cleanSubtotal * discountPercent) / 100);
  const taxable = Math.max(0, cleanSubtotal - discount);
  const tax = round2(taxable * TAX_RATE);
  const total = round2(taxable + cleanDeliveryFee + tax);
  return {
    subtotal: cleanSubtotal,
    deliveryFee: cleanDeliveryFee,
    discount,
    tax,
    total,
  };
}

export const ORDER_FLOW: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REJECTED",
];

/** Allowed outgoing transitions per status. Terminal states have none. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
