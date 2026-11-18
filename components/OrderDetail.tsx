"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Clock, MapPin, Star } from "lucide-react";
import { OrderSkeleton } from "./Skeletons";
import { useToast } from "./Toast";
import type { Order } from "./types";
import { num, unwrapObject } from "./types";
import { formatINR, ORDER_FLOW } from "@/lib/utils";

export const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  CONFIRMED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  PREPARING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  READY_FOR_PICKUP: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  PICKED_UP: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? "bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

interface FlowStep {
  status: string;
  label: string;
}

/** Normalise ORDER_FLOW whether it is string[] or { status, label }[]. */
function normaliseFlow(flow: unknown): FlowStep[] {
  if (!Array.isArray(flow)) return [];
  return flow
    .map((entry): FlowStep | null => {
      if (typeof entry === "string") return { status: entry, label: entry.replaceAll("_", " ") };
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const status = typeof obj.status === "string" ? obj.status : typeof obj.key === "string" ? obj.key : null;
        const label = typeof obj.label === "string" ? obj.label : status;
        return status && label ? { status, label } : null;
      }
      return null;
    })
    .filter((step): step is FlowStep => step !== null);
}

const FALLBACK_FLOW: FlowStep[] = [
  { status: "PLACED", label: "Order placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { status: "PICKED_UP", label: "Picked up" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

export default function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) throw new Error("Order not found");
        const payload = await res.json();
        const found = unwrapObject<Order>(payload, "order");
        if (!found) throw new Error("Order not found");
        if (!cancelled) setOrder(found);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <OrderSkeleton />
        <OrderSkeleton />
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-stone-900 dark:text-white">{error ?? "Order not found."}</p>
        <Link href="/orders" className="btn-primary mt-4">Back to orders</Link>
      </div>
    );
  }

  const items = order.items ?? order.order_items ?? [];
  const payments = order.payments ?? [];
  const payment = payments[0];
  const history = order.status_history ?? [];
  const historyByStatus = new Map(history.map((h) => [h.new_status, h.created_at]));
  // ORDER_FLOW includes the terminal CANCELLED/REJECTED states; the
  // timeline only shows the forward progress steps.
  const flow = normaliseFlow(ORDER_FLOW).filter(
    (s) => s.status !== "CANCELLED" && s.status !== "REJECTED",
  );
  const steps = flow.length > 0 ? flow : FALLBACK_FLOW;
  const currentIndex = steps.findIndex((s) => s.status === order.status);
  const isTerminal = order.status === "CANCELLED" || order.status === "REJECTED";
  const canCancel = order.status === "PLACED" || order.status === "CONFIRMED";

  const handleCancel = async () => {
    if (!window.confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        pushToast(data?.error || data?.message || "Could not cancel the order.", "error");
        return;
      }
      const payload = await res.json().catch(() => null);
      const updated = unwrapObject<Order>(payload, "order");
      setOrder(updated ?? { ...order, status: "CANCELLED" });
      pushToast("Order cancelled.", "success");
    } catch {
      pushToast("Could not cancel the order.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: order.restaurant_id ?? order.restaurant?.id,
          orderId: order.id,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        pushToast(data?.error || data?.message || "Could not submit the review.", "error");
        return;
      }
      setReviewDone(true);
      pushToast("Thanks for your review!", "success");
    } catch {
      pushToast("Could not submit the review.", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">Order #{order.id}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
            <Clock className="h-4 w-4" />
            Placed {fmtDate(order.placed_at ?? order.created_at)}
            {order.restaurant ? ` · ${order.restaurant.name}` : ""}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Tracking timeline */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-stone-900 dark:text-white">Track your order</h2>
        {isTerminal ? (
          <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
            This order was {order.status.toLowerCase()}.
          </p>
        ) : (
          <ol className="mt-5 space-y-0">
            {steps.map((step, i) => {
              const done = currentIndex >= 0 ? i <= currentIndex : false;
              const isCurrent = i === currentIndex;
              const at = historyByStatus.get(step.status);
              return (
                <li key={step.status} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < steps.length - 1 && (
                    <span className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${done ? "bg-emerald-500" : "bg-stone-200 dark:bg-stone-700"}`} />
                  )}
                  <span
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      done ? "bg-emerald-500 text-white" : "bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-300"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <div className="pt-0.5">
                    <p className={`text-sm font-semibold ${isCurrent ? "text-brand-600 dark:text-brand-400" : done ? "text-stone-800 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"}`}>
                      {step.label}
                      {isCurrent && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900 dark:text-brand-300">Current</span>}
                    </p>
                    {at && <p className="text-xs text-stone-500 dark:text-stone-400">{fmtDate(at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {canCancel && (
          <button type="button" onClick={handleCancel} disabled={cancelling} className="btn-secondary mt-5 !text-red-600 dark:!text-red-400">
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        )}
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <section className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Items</h2>
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
            {items.map((item, i) => (
              <li key={item.id ?? i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {item.item_name ?? item.name ?? item.foodItem?.name ?? "Item"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatINR(num(item.unit_price ?? item.price))} × {item.qty}
                  </p>
                </div>
                <span className="text-sm font-bold text-stone-900 dark:text-white">
                  {formatINR(num(item.line_total, num(item.unit_price ?? item.price) * item.qty))}
                </span>
              </li>
            ))}
            {items.length === 0 && <li className="py-3 text-sm text-stone-500">No items recorded for this order.</li>}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-stone-100 pt-4 text-sm dark:border-stone-800">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{formatINR(num(order.subtotal))}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Delivery fee</dt><dd className="font-medium">{formatINR(num(order.delivery_fee))}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Tax</dt><dd className="font-medium">{formatINR(num(order.tax_amount))}</dd></div>
            {num(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-600"><dt>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</dt><dd className="font-medium">−{formatINR(num(order.discount_amount))}</dd></div>
            )}
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold dark:border-stone-800">
              <dt>Total</dt><dd>{formatINR(num(order.total_amount ?? order.total))}</dd>
            </div>
          </dl>
          {order.instructions && (
            <p className="mt-4 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              <span className="font-semibold">Instructions: </span>{order.instructions}
            </p>
          )}
        </section>

        {/* Payment + address */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Payment</h2>
            {payment ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-stone-500">Method</dt><dd className="font-medium">{payment.method?.replaceAll("_", " ") ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Status</dt><dd className="font-medium">{payment.status ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-stone-500">Amount</dt><dd className="font-medium">{formatINR(num(payment.amount))}</dd></div>
                {payment.reference && (
                  <div className="flex justify-between gap-2"><dt className="text-stone-500">Reference</dt><dd className="truncate font-medium">{payment.reference}</dd></div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-stone-500">No payment recorded yet.</p>
            )}
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              SIMULATED — no real money was charged.
            </p>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
              <MapPin className="h-5 w-5 text-brand-500" /> Delivery address
            </h2>
            {order.address ? (
              <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                <span className="font-semibold text-stone-800 dark:text-stone-100">{order.address.label} — </span>
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city} {order.address.pincode}
              </p>
            ) : (
              <p className="mt-3 text-sm text-stone-500">No address recorded for this order.</p>
            )}
            {order.restaurant && (
              <Link href={`/restaurants/${order.restaurant.id}`} className="btn-secondary mt-4 w-full">
                Order again from {order.restaurant.name}
              </Link>
            )}
          </section>
        </div>
      </div>

      {/* Review */}
      {order.status === "DELIVERED" && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Rate your order</h2>
          {reviewDone ? (
            <p className="mt-3 text-sm font-medium text-emerald-600">Thanks — your review has been submitted.</p>
          ) : (
            <form onSubmit={handleReview} className="mt-4 space-y-4">
              <div>
                <span className="label">Rating</span>
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      aria-pressed={rating === star}
                      className="rounded p-1 transition hover:scale-110"
                    >
                      <Star className={`h-7 w-7 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300 dark:text-stone-600"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="review-comment" className="label">Comment (optional)</label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="How was the food and delivery?"
                  className="input resize-none"
                />
              </div>
              <button type="submit" disabled={submittingReview} className="btn-primary">
                {submittingReview ? "Submitting…" : "Submit review"}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
