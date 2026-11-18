"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { OrderSkeleton } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import type { CartData, Restaurant } from "@/components/types";
import {
  cartFoodId,
  cartItemImage,
  cartItemLineTotal,
  cartItemName,
  cartItemPrice,
  num,
  unwrapObject,
} from "@/components/types";
import { formatINR } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format&fit=crop";

const TAX_RATE = 0.05;

export default function CartPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // The cart API returns only restaurantId, so the delivery fee and
  // restaurant name are fetched from the restaurant itself.
  const [fetchedDeliveryFee, setFetchedDeliveryFee] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Could not load the cart");
      const payload = await res.json();
      const cartObj = unwrapObject<CartData>(payload, "cart");
      setCart(cartObj);
      const cartRestaurantId = cartObj?.restaurantId ?? cartObj?.restaurant_id;
      if (cartRestaurantId) {
        try {
          const rRes = await fetch(`/api/restaurants/${cartRestaurantId}`);
          if (rRes.ok) {
            const rData = await rRes.json();
            const restaurant = unwrapObject<Restaurant>(rData, "restaurant");
            if (restaurant) {
              setFetchedDeliveryFee(num(restaurant.delivery_fee));
              setRestaurantName(restaurant.name);
            }
          }
        } catch {
          // Delivery fee falls back to the default below.
        }
      } else {
        setFetchedDeliveryFee(null);
        setRestaurantName(null);
      }
    } catch {
      pushToast("Could not load your cart.", "error");
    } finally {
      setLoading(false);
    }
  }, [router, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateQty = async (foodItemId: number, qty: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodItemId, qty }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        pushToast(data?.error || data?.message || "Could not update the cart.", "error");
        return;
      }
      window.dispatchEvent(new Event("foodflow:cart-updated"));
      await load();
    } catch {
      pushToast("Could not update the cart.", "error");
    } finally {
      setBusy(false);
    }
  };

  const clearCart = async () => {
    if (!window.confirm("Remove all items from your cart?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cart", { method: "DELETE" });
      if (!res.ok) throw new Error("Clear failed");
      setCart(null);
      window.dispatchEvent(new Event("foodflow:cart-updated"));
      pushToast("Cart cleared.", "success");
    } catch {
      pushToast("Could not clear the cart.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <OrderSkeleton />
        <OrderSkeleton />
      </div>
    );
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-stone-300 dark:text-stone-600" />
        <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-white">Your cart is empty</h1>
        <p className="mt-2 text-sm text-stone-500">Add dishes from a restaurant to get started.</p>
        <Link href="/restaurants" className="btn-primary mt-6">Browse restaurants</Link>
      </div>
    );
  }

  // Totals are derived from the server-returned cart (item prices and any
  // server totals), never from prices typed in by the client.
  const serverSubtotal = num(cart?.subtotal, -1);
  const computedSubtotal = items.reduce((sum, item) => sum + cartItemLineTotal(item), 0);
  const subtotal = serverSubtotal >= 0 ? serverSubtotal : computedSubtotal;
  const serverDelivery = num(cart?.delivery_fee ?? cart?.deliveryFee, -1);
  const deliveryFee =
    serverDelivery >= 0 ? serverDelivery : (fetchedDeliveryFee ?? 29);
  const serverTax = num(cart?.tax_amount ?? cart?.tax, -1);
  const tax = serverTax >= 0 ? serverTax : subtotal * TAX_RATE;
  const serverTotal = num(cart?.total ?? cart?.total_amount, -1);
  const total = serverTotal >= 0 ? serverTotal : subtotal + deliveryFee + tax;
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">Your cart</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {itemCount} item{itemCount === 1 ? "" : "s"}
            {restaurantName ? ` · from ${restaurantName}` : ""}
          </p>
        </div>
        <button type="button" onClick={clearCart} disabled={busy} className="btn-secondary !text-red-600 dark:!text-red-400">
          <Trash2 className="h-4 w-4" /> Clear cart
        </button>
      </div>

      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        One restaurant per cart — adding a dish from another restaurant requires clearing this cart first.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.ul initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 lg:col-span-2">
          {items.map((item) => {
            const name = cartItemName(item);
            const price = cartItemPrice(item);
            const foodId = cartFoodId(item);
            return (
              <li key={item.id ?? foodId} className="card flex items-center gap-4 p-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
                  <Image src={cartItemImage(item) || FALLBACK_IMAGE} alt={name} fill sizes="80px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900 dark:text-white">{name}</p>
                  <p className="text-sm text-stone-500">{formatINR(price)} each</p>
                  {item.restaurantName && (
                    <p className="text-xs text-stone-400">{item.restaurantName}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-brand-500 p-1 text-white">
                  <button type="button" onClick={() => updateQty(foodId, item.qty - 1)} disabled={busy} aria-label={`Remove one ${name}`} className="rounded-lg p-1.5 hover:bg-brand-600 disabled:opacity-50">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-bold">{item.qty}</span>
                  <button type="button" onClick={() => updateQty(foodId, item.qty + 1)} disabled={busy} aria-label={`Add one more ${name}`} className="rounded-lg p-1.5 hover:bg-brand-600 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="w-20 text-right text-sm font-bold text-stone-900 dark:text-white">
                  {formatINR(cartItemLineTotal(item))}
                </span>
              </li>
            );
          })}
        </motion.ul>

        <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Bill summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{formatINR(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Delivery fee</dt><dd className="font-medium">{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Tax (5%)</dt><dd className="font-medium">{formatINR(tax)}</dd></div>
            <div className="flex justify-between border-t border-stone-100 pt-3 text-base font-bold dark:border-stone-800">
              <dt>Total</dt><dd>{formatINR(total)}</dd>
            </div>
          </dl>
          <button type="button" onClick={() => router.push("/checkout")} className="btn-primary mt-5 w-full">
            Proceed to checkout →
          </button>
          <Link href="/restaurants" className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
            Add more items
          </Link>
        </aside>
      </div>
    </div>
  );
}
