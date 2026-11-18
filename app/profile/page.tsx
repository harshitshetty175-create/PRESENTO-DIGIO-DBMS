"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Bell, Heart, Home, MapPin, Star, Trash2, User } from "lucide-react";
import { OrderSkeleton } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import type { Address, CurrentUser, FavouriteRow, NotificationItem, ReviewRow } from "@/components/types";
import { num, unwrapArray, unwrapObject } from "@/components/types";
import { formatINR } from "@/lib/utils";

type Tab = "addresses" | "favourites" | "reviews" | "notifications";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format&fit=crop";

export default function ProfilePage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favourites, setFavourites] = useState<FavouriteRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("addresses");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "", pincode: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meRes, addrRes, favRes, revRes, notifRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/addresses"),
        fetch("/api/favourites"),
        fetch("/api/reviews?mine=true"),
        fetch("/api/notifications"),
      ]);
      if (meRes.status === 401) {
        router.push("/login");
        return;
      }
      const [meData, addrData, favData, revData, notifData] = await Promise.all([
        meRes.ok ? meRes.json().catch(() => null) : null,
        addrRes.ok ? addrRes.json().catch(() => null) : null,
        favRes.ok ? favRes.json().catch(() => null) : null,
        revRes.ok ? revRes.json().catch(() => null) : null,
        notifRes.ok ? notifRes.json().catch(() => null) : null,
      ]);
      setUser(unwrapObject<CurrentUser>(meData, "user"));
      setAddresses(unwrapArray<Address>(addrData, "addresses"));
      setFavourites(unwrapArray<FavouriteRow>(favData, "favourites"));
      setReviews(unwrapArray<ReviewRow>(revData, "reviews"));
      setNotifications(unwrapArray<NotificationItem>(notifData, "notifications"));
    } catch {
      pushToast("Could not load your profile.", "error");
    } finally {
      setLoading(false);
    }
  }, [router, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line1.trim() || !form.city.trim() || !/^\d{6}$/.test(form.pincode.trim())) {
      setFormError("Enter a street address, city, and a 6-digit pincode.");
      return;
    }
    setFormError(null);
    setSavingAddress(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          city: form.city.trim(),
          pincode: form.pincode.trim(),
          is_default: addresses.length === 0,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error || data?.message || "Could not save the address.");
        return;
      }
      setShowAddressForm(false);
      setForm({ label: "Home", line1: "", line2: "", city: "", pincode: "" });
      pushToast("Address saved.", "success");
      await load();
    } catch {
      setFormError("Could not save the address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const deleteAddress = async (id: number) => {
    if (!window.confirm("Delete this address?")) return;
    try {
      // The API deletes via the collection route: DELETE /api/addresses?id=
      const res = await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      pushToast("Address deleted.", "success");
      await load();
    } catch {
      pushToast("Could not delete the address.", "error");
    }
  };

  const removeFavourite = async (foodItemId: number) => {
    try {
      const res = await fetch(`/api/favourites?foodItemId=${foodItemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setFavourites((prev) => prev.filter((f) => f.food_item_id !== foodItemId));
      pushToast("Removed from favourites.", "success");
    } catch {
      pushToast("Could not remove the favourite.", "error");
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Mark-read failed");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      pushToast("All notifications marked as read.", "success");
    } catch {
      pushToast("Could not mark notifications as read.", "error");
    }
  };

  const markOneRead = async (id: number) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Mark-read failed");
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // Best-effort; leave the item unread on failure.
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

  const tabs: { key: Tab; label: string; icon: typeof Home; count?: number }[] = [
    { key: "addresses", label: "Addresses", icon: Home, count: addresses.length },
    { key: "favourites", label: "Favourites", icon: Heart, count: favourites.length },
    { key: "reviews", label: "My reviews", icon: Star, count: reviews.length },
    { key: "notifications", label: "Notifications", icon: Bell, count: notifications.filter((n) => !n.is_read).length },
  ];

  return (
    <div className="py-6">
      {/* Profile header */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          <User className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-stone-900 dark:text-white">{user?.name ?? "My profile"}</h1>
          <p className="truncate text-sm text-stone-500 dark:text-stone-400">{user?.email}</p>
          {user?.phone && <p className="text-sm text-stone-500 dark:text-stone-400">{user.phone}</p>}
        </div>
        <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-900/40 dark:text-brand-300">
          {user?.role?.replaceAll("_", " ") ?? "CUSTOMER"}
        </span>
        <Link href="/orders" className="btn-secondary">My orders</Link>
      </motion.section>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${tab === t.key ? "bg-white/25" : "bg-stone-100 dark:bg-stone-800"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Addresses */}
      {tab === "addresses" && (
        <section className="mt-6 space-y-4">
          {addresses.length === 0 && !showAddressForm && (
            <p className="text-sm text-stone-500">No saved addresses yet.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="card flex items-start gap-3 p-5">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900 dark:text-white">
                    {address.label}
                    {address.is_default ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">Default</span> : null}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city} {address.pincode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAddress(address.id)}
                  aria-label={`Delete ${address.label} address`}
                  className="rounded-full p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setShowAddressForm((v) => !v)} className="btn-secondary">
            {showAddressForm ? "Hide address form" : "+ Add a new address"}
          </button>
          {showAddressForm && (
            <form onSubmit={saveAddress} className="card space-y-3 p-5">
              {formError && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-addr-label" className="label">Label</label>
                  <select id="profile-addr-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input">
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="profile-addr-pincode" className="label">Pincode</label>
                  <input id="profile-addr-pincode" inputMode="numeric" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="560001" className="input" />
                </div>
              </div>
              <div>
                <label htmlFor="profile-addr-line1" className="label">Street address</label>
                <input id="profile-addr-line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Flat / house no., street" className="input" />
              </div>
              <div>
                <label htmlFor="profile-addr-line2" className="label">Landmark (optional)</label>
                <input id="profile-addr-line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Near…" className="input" />
              </div>
              <div>
                <label htmlFor="profile-addr-city" className="label">City</label>
                <input id="profile-addr-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" className="input" />
              </div>
              <button type="submit" disabled={savingAddress} className="btn-primary">
                {savingAddress ? "Saving…" : "Save address"}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Favourites */}
      {tab === "favourites" && (
        <section className="mt-6">
          {favourites.length === 0 ? (
            <p className="text-sm text-stone-500">No favourites yet — tap the heart on any dish to save it here.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favourites.map((fav) => {
                const food = fav.foodItem ?? fav.food_item;
                if (!food) return null;
                return (
                  <div key={fav.id ?? fav.food_item_id} className="card flex items-center gap-3 p-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
                      <Image src={food.image_url || FALLBACK_IMAGE} alt={food.name} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-900 dark:text-white">{food.name}</p>
                      <p className="text-sm text-stone-500">{formatINR(num(food.price))}</p>
                      {food.restaurant?.name && <p className="truncate text-xs text-stone-400">{food.restaurant.name}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {food.restaurant_id && (
                        <Link href={`/restaurants/${food.restaurant_id}`} className="btn-primary !px-3 !py-1.5 !text-xs">View</Link>
                      )}
                      <button type="button" onClick={() => removeFavourite(fav.food_item_id)} aria-label={`Remove ${food.name} from favourites`} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Reviews */}
      {tab === "reviews" && (
        <section className="mt-6 space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-stone-500">You haven&apos;t written any reviews yet. Reviews can be left on delivered orders.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    <Star className="h-3 w-3 fill-white" /> {review.rating}
                  </span>
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {review.restaurant?.name ?? review.foodItem?.name ?? "Restaurant"}
                  </span>
                  {review.created_at && (
                    <span className="text-xs text-stone-400">
                      {new Date(review.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  )}
                </div>
                {review.comment && <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{review.comment}</p>}
              </div>
            ))
          )}
        </section>
      )}

      {/* Notifications */}
      {tab === "notifications" && (
        <section className="mt-6">
          {notifications.length === 0 ? (
            <p className="text-sm text-stone-500">No notifications yet.</p>
          ) : (
            <>
              <button type="button" onClick={markAllRead} className="btn-secondary mb-4">Mark all as read</button>
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => markOneRead(n.id)}
                      className={`card block w-full p-4 text-left transition ${n.is_read ? "opacity-70" : "ring-2 ring-brand-200 dark:ring-brand-900"}`}
                    >
                      <span className="flex items-start gap-3">
                        <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.is_read ? "text-stone-400" : "text-brand-500"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-stone-900 dark:text-white">{n.title}</span>
                          {n.body && <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">{n.body}</span>}
                          {n.created_at && (
                            <span className="mt-1 block text-xs text-stone-400">
                              {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          )}
                        </span>
                        {!n.is_read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
