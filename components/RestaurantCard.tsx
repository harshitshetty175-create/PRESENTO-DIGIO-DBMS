"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bike, Clock, Star } from "lucide-react";
import type { Restaurant } from "./types";
import { num } from "./types";
import { formatINR } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80&auto=format&fit=crop";

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const rating = num(restaurant.rating);
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="card group block overflow-hidden transition-shadow hover:shadow-lift"
      >
        <div className="relative h-44 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
          <Image
            src={restaurant.image_url || FALLBACK_IMAGE}
            alt={restaurant.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
          {!restaurant.is_open && (
            <span className="absolute left-3 top-3 rounded-full bg-stone-900/85 px-2.5 py-1 text-xs font-semibold text-white">
              Currently closed
            </span>
          )}
          {restaurant.is_open && (
            <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
              Open now
            </span>
          )}
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-stone-900 shadow">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {rating > 0 ? rating.toFixed(1) : "New"}
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-stone-900 group-hover:text-brand-600 dark:text-white">
              {restaurant.name}
            </h3>
          </div>
          <p className="mt-0.5 truncate text-sm text-stone-500 dark:text-stone-400">
            {restaurant.cuisine}
            {restaurant.city ? ` · ${restaurant.city}` : ""}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs font-medium text-stone-600 dark:text-stone-300">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-brand-500" />
              {restaurant.delivery_mins} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-brand-500" />
              {num(restaurant.delivery_fee) === 0 ? "Free delivery" : `${formatINR(num(restaurant.delivery_fee))} delivery`}
            </span>
            {num(restaurant.min_order) > 0 && (
              <span className="text-stone-400">Min {formatINR(num(restaurant.min_order))}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
