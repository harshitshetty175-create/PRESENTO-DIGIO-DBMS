"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, Minus, Plus, Star } from "lucide-react";
import { useToast } from "./Toast";
import type { FoodItem } from "./types";
import { num } from "./types";
import { formatINR } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&auto=format&fit=crop";

function isVeg(food: FoodItem): boolean {
  if (typeof food.is_veg === "boolean") return food.is_veg;
  const t = (food.veg_type || "").toUpperCase();
  return t !== "NON_VEG";
}

export default function FoodCard({
  food,
  initialQty = 0,
  initialFavourite = false,
}: {
  food: FoodItem;
  initialQty?: number;
  initialFavourite?: boolean;
}) {
  const { pushToast } = useToast();
  const [qty, setQty] = useState(initialQty);
  const [favourite, setFavourite] = useState(initialFavourite);
  const [busy, setBusy] = useState(false);

  const categoryName =
    typeof food.category === "object" && food.category ? food.category.name : null;
  const available = food.is_available !== false;

  const syncCart = async (nextQty: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: nextQty === 0 && qty > 0 ? "PATCH" : qty === 0 ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodItemId: food.id, qty: nextQty }),
      });
      if (res.status === 409) {
        pushToast("Your cart has items from another restaurant. Clear it first to order here.", "error");
        return false;
      }
      if (res.status === 401) {
        pushToast("Please log in to add items to your cart.", "error");
        return false;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        pushToast(data?.error || data?.message || "Could not update the cart.", "error");
        return false;
      }
      setQty(nextQty);
      window.dispatchEvent(new Event("foodflow:cart-updated"));
      return true;
    } catch {
      pushToast("Could not update the cart. Check your connection.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleFavourite = async () => {
    const next = !favourite;
    setFavourite(next); // optimistic
    try {
      const res = next
        ? await fetch("/api/favourites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ foodItemId: food.id }),
          })
        : await fetch(`/api/favourites?foodItemId=${food.id}`, { method: "DELETE" });
      if (res.status === 401) {
        setFavourite(!next);
        pushToast("Please log in to save favourites.", "error");
        return;
      }
      if (!res.ok) {
        setFavourite(!next);
        pushToast("Could not update favourites.", "error");
        return;
      }
      pushToast(next ? "Saved to favourites" : "Removed from favourites", "success");
    } catch {
      setFavourite(!next);
      pushToast("Could not update favourites.", "error");
    }
  };

  const veg = isVeg(food);
  const rating = num(food.rating);

  return (
    <motion.article
      whileTap={{ scale: 0.98 }}
      className="card flex flex-col overflow-hidden"
    >
      <div className="relative h-40 w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
        <Image
          src={food.image_url || FALLBACK_IMAGE}
          alt={food.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        <button
          type="button"
          onClick={toggleFavourite}
          aria-label={favourite ? `Remove ${food.name} from favourites` : `Save ${food.name} to favourites`}
          aria-pressed={favourite}
          className="absolute right-2.5 top-2.5 rounded-full bg-white/95 p-2 shadow transition hover:scale-110 dark:bg-stone-900/95"
        >
          <Heart className={`h-4 w-4 ${favourite ? "fill-red-500 text-red-500" : "text-stone-500"}`} />
        </button>
        <span
          className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            veg ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {veg ? "VEG" : "NON-VEG"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-snug text-stone-900 dark:text-white">{food.name}</h3>
          {rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white">
              <Star className="h-3 w-3 fill-white" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        {categoryName && <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{categoryName}</p>}
        {food.description && (
          <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            {food.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-base font-bold text-stone-900 dark:text-white">{formatINR(num(food.price))}</span>
          {!available ? (
            <span className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-500 dark:bg-stone-800">
              Unavailable
            </span>
          ) : qty === 0 ? (
            <button type="button" onClick={() => syncCart(1)} disabled={busy} className="btn-primary !px-4 !py-2">
              Add
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl bg-brand-500 p-1 text-white shadow-sm">
              <button
                type="button"
                onClick={() => syncCart(qty - 1)}
                disabled={busy}
                aria-label={`Remove one ${food.name}`}
                className="rounded-lg p-1.5 transition hover:bg-brand-600 disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-bold" aria-live="polite">{qty}</span>
              <button
                type="button"
                onClick={() => syncCart(qty + 1)}
                disabled={busy}
                aria-label={`Add one more ${food.name}`}
                className="rounded-lg p-1.5 transition hover:bg-brand-600 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
