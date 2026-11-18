"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Package } from "lucide-react";
import { OrderSkeleton } from "@/components/Skeletons";
import { StatusBadge } from "@/components/OrderDetail";
import type { Order } from "@/components/types";
import { num, unwrapArray } from "@/components/types";
import { formatINR } from "@/lib/utils";

const FILTERS = ["ALL", "PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "ALL" ? "/api/orders" : `/api/orders?status=${filter}`;
      const res = await fetch(url);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load orders");
      const data = await res.json();
      setOrders(unwrapArray<Order>(data, "orders"));
      setError(null);
    } catch {
      setError("Could not load your orders. Try again.");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <div className="skeleton-shimmer h-8 w-48 rounded" />
        <OrderSkeleton />
        <OrderSkeleton />
        <OrderSkeleton />
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">My orders</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Track and review your past orders.</p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            aria-pressed={filter === status}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === status
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
            }`}
          >
            {status === "ALL" ? "All" : status.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm font-medium text-red-600" role="alert">{error}</p>}

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="mx-auto h-12 w-12 text-stone-300 dark:text-stone-600" />
          <p className="mt-4 text-lg font-semibold text-stone-900 dark:text-white">No orders yet</p>
          <p className="mt-1 text-sm text-stone-500">
            {filter === "ALL" ? "Your orders will show up here once you place one." : `No ${filter.replaceAll("_", " ").toLowerCase()} orders.`}
          </p>
          <Link href="/restaurants" className="btn-primary mt-6">Browse restaurants</Link>
        </div>
      ) : (
        <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-4">
          {orders.map((order) => {
            const items = order.items ?? order.order_items ?? [];
            const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
            const placed = order.placed_at ?? order.created_at;
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="card block p-5 transition-shadow hover:shadow-lift sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-stone-900 dark:text-white">
                        Order #{order.id}
                        {order.restaurant ? <span className="font-medium text-stone-500"> · {order.restaurant.name}</span> : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {placed ? new Date(placed).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
                        {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  {items.length > 0 && (
                    <p className="mt-3 truncate text-sm text-stone-600 dark:text-stone-300">
                      {items.map((item) => `${item.item_name ?? item.name ?? item.foodItem?.name ?? item.food_item?.name ?? "Item"} × ${item.qty}`).join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-bold text-stone-900 dark:text-white">
                      {formatINR(num(order.total_amount ?? order.total))}
                    </span>
                    <span className="text-sm font-semibold text-brand-600">View details →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
