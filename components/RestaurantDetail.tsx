"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bike, Clock, MapPin, Phone, ShoppingCart, Star } from "lucide-react";
import FoodCard from "./FoodCard";
import { FoodSkeleton } from "./Skeletons";
import type { CartData, FoodItem, Restaurant, ReviewRow } from "./types";
import { cartFoodId, cartItemLineTotal, num, unwrapObject } from "./types";
import { formatINR } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop";

interface CategoryGroup {
  category: { id: number; name: string; slug: string };
  items: FoodItem[];
}

interface RestaurantDetailPayload {
  restaurant: Restaurant;
  groups: CategoryGroup[];
  reviews: ReviewRow[];
}

export default function RestaurantDetail({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<RestaurantDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const loadCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) return;
      const payload = await res.json();
      setCart(unwrapObject<CartData>(payload, "cart"));
    } catch {
      // Cart bar is best-effort.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}`);
        if (!res.ok) throw new Error("Restaurant not found");
        const payload = await res.json();
        const restaurant = unwrapObject<Restaurant>(payload, "restaurant");
        if (!restaurant) throw new Error("Restaurant not found");
        if (!cancelled) {
          // Real API shape: { restaurant: {..., reviews: [...] },
          //   categories: [{ category: {...}, items: [...] }] }.
          // Fallbacks keep the older { menu, reviews } shape working too.
          const raw = payload as Record<string, unknown>;
          const groups: CategoryGroup[] = Array.isArray(raw.categories)
            ? (raw.categories as CategoryGroup[])
            : [];
          const menu: FoodItem[] = Array.isArray(raw.menu)
            ? (raw.menu as FoodItem[])
            : (restaurant.food_items ?? []);
          const derivedGroups: CategoryGroup[] =
            groups.length > 0
              ? groups
              : (() => {
                  const map = new Map<string, FoodItem[]>();
                  for (const item of menu) {
                    const name =
                      typeof item.category === "object" && item.category
                        ? item.category.name
                        : "Menu";
                    const list = map.get(name) ?? [];
                    list.push(item);
                    map.set(name, list);
                  }
                  return [...map.entries()].map(([name, items]) => ({
                    category: { id: 0, name, slug: name.toLowerCase() },
                    items,
                  }));
                })();
          setData({
            restaurant,
            groups: derivedGroups,
            reviews:
              restaurant.reviews ??
              (Array.isArray(raw.reviews) ? (raw.reviews as ReviewRow[]) : []),
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this restaurant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    loadCart();
    const onCartUpdated = () => loadCart();
    window.addEventListener("foodflow:cart-updated", onCartUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("foodflow:cart-updated", onCartUpdated);
    };
  }, [restaurantId, loadCart]);

  const grouped = useMemo(() => {
    const groups = data?.groups ?? [];
    return groups.map((g) => [g.category.name, g.items] as [string, FoodItem[]]);
  }, [data]);

  const categories = useMemo(() => ["All", ...grouped.map(([name]) => name)], [grouped]);
  const visibleGroups = activeCategory === "All" ? grouped : grouped.filter(([name]) => name === activeCategory);

  const cartItems = cart?.items ?? [];
  const cartSubtotal = cartItems.reduce((sum, item) => sum + cartItemLineTotal(item), 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const cartQtyByFood = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cartItems) map.set(cartFoodId(item), item.qty);
    return map;
  }, [cartItems]);

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <div className="skeleton-shimmer h-64 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <FoodSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-stone-900 dark:text-white">{error ?? "Restaurant not found."}</p>
        <Link href="/restaurants" className="btn-primary mt-4">Browse restaurants</Link>
      </div>
    );
  }

  const { restaurant, reviews } = data;
  const rating = num(restaurant.rating);

  return (
    <div className="py-6 pb-28">
      {/* Banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        <div className="relative h-56 w-full sm:h-72">
          <Image
            src={restaurant.image_url || FALLBACK_IMAGE}
            alt={restaurant.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-stone-900/35" />
          <div className="absolute bottom-0 left-0 p-5 sm:p-6">
            <span className={`badge ${restaurant.is_open ? "bg-emerald-600 text-white" : "bg-stone-900/85 text-white"}`}>
              {restaurant.is_open ? "Open now" : "Currently closed"}
            </span>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{restaurant.name}</h1>
            <p className="mt-1 text-sm font-medium text-stone-100">
              {restaurant.cuisine}
              {restaurant.city ? ` · ${restaurant.city}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-sm sm:px-6">
          <span className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-stone-100">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {rating > 0 ? `${rating.toFixed(1)} rating` : "No ratings yet"}
            {reviews.length > 0 && <span className="font-normal text-stone-500">({reviews.length} reviews)</span>}
          </span>
          <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
            <Clock className="h-4 w-4 text-brand-500" /> {restaurant.delivery_mins} min delivery
          </span>
          <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
            <Bike className="h-4 w-4 text-brand-500" />
            {num(restaurant.delivery_fee) === 0 ? "Free delivery" : `${formatINR(num(restaurant.delivery_fee))} delivery fee`}
          </span>
          {restaurant.address && (
            <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
              <MapPin className="h-4 w-4 text-brand-500" /> {restaurant.address}
            </span>
          )}
          {restaurant.phone && (
            <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
              <Phone className="h-4 w-4 text-brand-500" /> {restaurant.phone}
            </span>
          )}
        </div>
        {restaurant.description && (
          <p className="border-t border-stone-100 px-5 py-4 text-sm leading-relaxed text-stone-600 sm:px-6 dark:border-stone-800 dark:text-stone-300">
            {restaurant.description}
          </p>
        )}
      </motion.section>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="sticky top-16 z-30 -mx-4 mt-6 overflow-x-auto bg-cream/95 px-4 py-3 backdrop-blur dark:bg-stone-950/95">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === cat
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      {visibleGroups.length === 0 ? (
        <p className="py-12 text-center text-stone-500">No menu items available yet.</p>
      ) : (
        visibleGroups.map(([categoryName, items]) => (
          <section key={categoryName} className="mt-8">
            <h2 className="text-xl font-bold text-stone-900 dark:text-white">{categoryName}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((food) => (
                <FoodCard key={food.id} food={food} initialQty={cartQtyByFood.get(food.id) ?? 0} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">Reviews</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {reviews.slice(0, 6).map((review) => (
              <div key={review.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    <Star className="h-3 w-3 fill-white" /> {review.rating}
                  </span>
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {review.user?.name ?? "Customer"}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart summary bar */}
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
        >
          <Link
            href="/cart"
            className="flex items-center justify-between gap-3 rounded-2xl bg-brand-500 px-5 py-4 text-white shadow-lift transition hover:bg-brand-600"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-5 w-5" />
              {cartCount} item{cartCount === 1 ? "" : "s"} in cart
            </span>
            <span className="text-sm font-bold">
              {formatINR(num(cart?.subtotal, cartSubtotal))} · View cart →
            </span>
          </Link>
        </motion.div>
      )}
      {cartCount > 0 && (
        <span className="sr-only" aria-live="polite">
          {cartCount} items in cart, subtotal {formatINR(num(cart?.subtotal, cartSubtotal))}
        </span>
      )}
    </div>
  );
}
