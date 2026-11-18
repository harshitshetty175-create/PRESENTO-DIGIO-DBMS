"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bike,
  ChevronRight,
  Clock,
  Percent,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import RestaurantCard from "@/components/RestaurantCard";
import FoodCard from "@/components/FoodCard";
import { FoodSkeleton, RestaurantSkeleton } from "@/components/Skeletons";
import type { Category, Coupon, FoodItem, Restaurant } from "@/components/types";
import { num, unwrapArray } from "@/components/types";
import { formatINR } from "@/lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop";

/* Static marketing quotes only — the only static text in the customer UI. */
const TESTIMONIALS = [
  {
    quote: "Dinner arrived hot in under half an hour, and tracking the order live made the wait easy.",
    name: "Ananya S.",
    role: "Regular customer",
  },
  {
    quote: "The menu is easy to browse and the veg filters actually work. My go-to for weeknight meals.",
    name: "Rahul M.",
    role: "Foodie",
  },
  {
    quote: "Ordering for the whole hostel floor took minutes. The cart and checkout just work.",
    name: "Priya K.",
    role: "Student",
  },
];

const HOW_IT_WORKS = [
  { icon: Search, title: "Find your food", text: "Search restaurants and dishes, filter by veg or cuisine." },
  { icon: ShoppingBag, title: "Build your cart", text: "Add dishes, apply a coupon, and pick a delivery address." },
  { icon: Bike, title: "Track delivery", text: "Follow your order from the kitchen to your door, live." },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5 },
};

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, couponRes, restRes, foodRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/coupons"),
          fetch("/api/restaurants?sort=rating"),
          fetch("/api/foods?sort=rating"),
        ]);
        const [catData, couponData, restData, foodData] = await Promise.all([
          catRes.ok ? catRes.json().catch(() => null) : null,
          couponRes.ok ? couponRes.json().catch(() => null) : null,
          restRes.ok ? restRes.json().catch(() => null) : null,
          foodRes.ok ? foodRes.json().catch(() => null) : null,
        ]);
        if (cancelled) return;
        setCategories(unwrapArray<Category>(catData, "categories"));
        setCoupons(unwrapArray<Coupon>(couponData, "coupons").filter((c) => c.is_active !== false));
        setRestaurants(unwrapArray<Restaurant>(restData, "restaurants").slice(0, 6));
        setFoods(unwrapArray<FoodItem>(foodData, "foods").slice(0, 8));
      } catch {
        // Sections render empty states; the page itself stays usable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/restaurants${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-900">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Order food online
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-5xl dark:text-white">
            Great food, delivered hot to your door.
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-stone-500 dark:text-stone-400">
            Browse restaurants near you, build your cart, and track every order
            live — from the kitchen to your doorstep.
          </p>
          <form onSubmit={handleSearch} className="mt-6 flex max-w-lg gap-2" role="search">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search restaurants or dishes…"
                aria-label="Search restaurants or dishes"
                className="input !rounded-full !py-3 !pl-10"
              />
            </div>
            <button type="submit" className="btn-primary !rounded-full !px-6 !py-3">Search</button>
          </form>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-stone-600 dark:text-stone-300">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-500" /> 30 min avg. delivery</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Top-rated restaurants</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand-500" /> Simulated payments only</span>
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/restaurants" className="btn-primary">Browse restaurants <ChevronRight className="h-4 w-4" /></Link>
            <Link href="/orders" className="btn-secondary">Track my order</Link>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative hidden overflow-hidden rounded-3xl shadow-lift lg:block"
        >
          <Image src={HERO_IMAGE} alt="A spread of freshly prepared dishes" width={1200} height={800} priority className="h-[420px] w-full object-cover" />
          <div className="absolute bottom-4 left-4 rounded-2xl bg-white px-4 py-3 shadow-lift dark:bg-stone-900">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Average delivery</p>
            <p className="text-lg font-bold text-stone-900 dark:text-white">30–40 min</p>
          </div>
        </motion.div>
      </section>

      {/* Promo offers */}
      {coupons.length > 0 && (
        <motion.section {...fadeUp}>
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-brand-500" />
            <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Offers for you</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.slice(0, 3).map((coupon) => (
              <div key={coupon.id} className="card flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-lg font-extrabold tracking-wide text-brand-600 dark:text-brand-400">{coupon.code}</p>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {coupon.description ?? `${num(coupon.discount_percent)}% off your order`}
                  </p>
                  {num(coupon.min_order) > 0 && (
                    <p className="mt-0.5 text-xs text-stone-400">Min. order {formatINR(num(coupon.min_order))}</p>
                  )}
                </div>
                <Link href="/restaurants" className="btn-primary shrink-0 !px-4 !py-2">Use code</Link>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Categories */}
      <motion.section {...fadeUp} className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Browse by category</h2>
          <Link href="/restaurants" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all →</Link>
        </div>
        {loading ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Categories will appear once the menu is seeded.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/restaurants?category=${encodeURIComponent(category.slug)}`}
                className="card group overflow-hidden transition-shadow hover:shadow-lift"
              >
                {category.image_url ? (
                  <div className="relative h-20 w-full overflow-hidden">
                    <Image src={category.image_url} alt={category.name} fill sizes="200px" className="object-cover transition duration-300 group-hover:scale-105" />
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center bg-brand-50 dark:bg-stone-800">
                    <UtensilsCrossed className="h-7 w-7 text-brand-500" />
                  </div>
                )}
                <p className="p-3 text-center text-sm font-semibold text-stone-800 dark:text-stone-100">{category.name}</p>
              </Link>
            ))}
          </div>
        )}
      </motion.section>

      {/* Featured restaurants */}
      <motion.section {...fadeUp} className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Top-rated restaurants</h2>
          <Link href="/restaurants?sort=rating" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all →</Link>
        </div>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <RestaurantSkeleton key={i} />)}
          </div>
        ) : restaurants.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No restaurants available yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
          </div>
        )}
      </motion.section>

      {/* Popular dishes */}
      <motion.section {...fadeUp} className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Popular dishes</h2>
          <Link href="/restaurants" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Explore menus →</Link>
        </div>
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <FoodSkeleton key={i} />)}
          </div>
        ) : foods.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Popular dishes will appear once the menu is seeded.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {foods.map((food) => <FoodCard key={food.id} food={food} />)}
          </div>
        )}
      </motion.section>

      {/* How it works */}
      <motion.section {...fadeUp} className="mt-14">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">How it works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
                <step.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-bold text-brand-600">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold text-stone-900 dark:text-white">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{step.text}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Testimonials (static marketing quotes) */}
      <motion.section {...fadeUp} className="mt-14">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">What customers say</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card p-6">
              <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-stone-900 dark:text-white">{t.name}</span>
                <span className="text-stone-500"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </motion.section>

      {/* Footer CTA */}
      <motion.section {...fadeUp} className="mt-14">
        <div className="rounded-3xl bg-brand-500 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">Hungry? Your next meal is minutes away.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-50">
            Browse top-rated restaurants, apply a coupon, and track your order live.
          </p>
          <Link href="/restaurants" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-600 shadow-sm transition hover:bg-brand-50">
            Order now <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
