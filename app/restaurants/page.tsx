"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import RestaurantCard from "@/components/RestaurantCard";
import FoodCard from "@/components/FoodCard";
import { FoodSkeleton, RestaurantSkeleton } from "@/components/Skeletons";
import type { Category, FoodItem, Restaurant } from "@/components/types";
import { unwrapArray } from "@/components/types";

type SortKey = "rating" | "delivery_mins" | "delivery_fee" | "name";

function RestaurantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category") ?? "";

  const [query, setQuery] = useState(q);
  const [cuisine, setCuisine] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("rating");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep the input in sync when arriving from the navbar / landing search.
  useEffect(() => setQuery(q), [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      // API sort values: rating | delivery_mins | price (delivery fee).
      // Name sorting is done client-side below.
      if (sort === "delivery_fee") params.set("sort", "price");
      else if (sort !== "name") params.set("sort", sort);
      const [restRes, catRes] = await Promise.all([
        fetch(`/api/restaurants?${params.toString()}`),
        fetch("/api/categories"),
      ]);
      const [restData, catData] = await Promise.all([
        restRes.ok ? restRes.json().catch(() => null) : null,
        catRes.ok ? catRes.json().catch(() => null) : null,
      ]);
      const cats = unwrapArray<Category>(catData, "categories");
      setCategories(cats);
      setRestaurants(unwrapArray<Restaurant>(restData, "restaurants"));
      // Dish results only matter when searching or browsing a category.
      // /api/foods takes a numeric categoryId, so resolve the slug first.
      if (q.trim() || categorySlug) {
        const foodParams = new URLSearchParams({ sort: "rating" });
        if (q.trim()) foodParams.set("q", q.trim());
        const category = cats.find((c) => c.slug === categorySlug);
        if (category) foodParams.set("categoryId", String(category.id));
        const foodRes = await fetch(`/api/foods?${foodParams.toString()}`);
        const foodData = foodRes.ok ? await foodRes.json().catch(() => null) : null;
        setFoods(unwrapArray<FoodItem>(foodData, "foods"));
      } else {
        setFoods([]);
      }
    } catch {
      setRestaurants([]);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }, [q, sort, categorySlug]);

  useEffect(() => {
    load();
  }, [load]);

  const cuisines = useMemo(
    () => [...new Set(restaurants.map((r) => r.cuisine).filter(Boolean))].sort(),
    [restaurants],
  );

  const filteredRestaurants = useMemo(() => {
    let list = cuisine ? restaurants.filter((r) => r.cuisine === cuisine) : restaurants;
    const sorted = [...list];
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => Number(b.rating) - Number(a.rating));
        break;
      case "delivery_mins":
        sorted.sort((a, b) => a.delivery_mins - b.delivery_mins);
        break;
      case "delivery_fee":
        sorted.sort((a, b) => Number(a.delivery_fee) - Number(b.delivery_fee));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [restaurants, cuisine, sort]);

  const filteredFoods = useMemo(() => {
    let list = foods;
    if (vegOnly) list = list.filter((f) => f.is_veg !== false && (f.veg_type ?? "VEG").toUpperCase() !== "NON_VEG");
    return list;
  }, [foods, vegOnly]);

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (categorySlug) params.set("category", categorySlug);
    router.push(`/restaurants${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <div className="py-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">
          {q ? `Results for “${q}”` : activeCategory ? `${activeCategory.name} restaurants` : "Restaurants"}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {loading ? "Loading…" : `${filteredRestaurants.length} restaurant${filteredRestaurants.length === 1 ? "" : "s"} found`}
        </p>
      </motion.div>

      {/* Filters */}
      <div className="card mt-5 flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <form onSubmit={applySearch} className="flex flex-1 gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants or dishes…"
              aria-label="Search restaurants or dishes"
              className="input !pl-9"
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            aria-label="Filter by cuisine"
            className="input !w-auto"
          >
            <option value="">All cuisines</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort restaurants"
            className="input !w-auto"
          >
            <option value="rating">Top rated</option>
            <option value="delivery_mins">Fastest delivery</option>
            <option value="delivery_fee">Lowest delivery fee</option>
            <option value="name">Name A–Z</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-medium text-stone-700 dark:border-stone-700 dark:text-stone-200">
            <input
              type="checkbox"
              checked={vegOnly}
              onChange={(e) => setVegOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Veg only
          </label>
        </div>
      </div>

      {/* Restaurants */}
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <RestaurantSkeleton key={i} />)}
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <p className="mt-10 text-center text-stone-500">
          No restaurants match your search. Try a different keyword or cuisine.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
        </div>
      )}

      {/* Dishes matching the search / category */}
      {(q.trim() || categorySlug) && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">
            {q.trim() ? `Dishes matching “${q}”` : `${activeCategory?.name ?? "Category"} dishes`}
          </h2>
          {loading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <FoodSkeleton key={i} />)}
            </div>
          ) : filteredFoods.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No dishes match your search.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filteredFoods.slice(0, 12).map((food) => <FoodCard key={food.id} food={food} />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <RestaurantSkeleton key={i} />)}</div>}>
      <RestaurantsContent />
    </Suspense>
  );
}
