"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, MapPin, Plus, ShieldCheck } from "lucide-react";
import { OrderSkeleton } from "@/components/Skeletons";
import { useToast } from "@/components/Toast";
import type { Address, CartData, Restaurant } from "@/components/types";
import {
  cartItemLineTotal,
  cartItemName,
  num,
  unwrapArray,
  unwrapObject,
} from "@/components/types";
import { formatINR } from "@/lib/utils";

type PaymentMethod = "COD" | "UPI_SIMULATED" | "CARD_SIMULATED";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "COD", label: "Cash on Delivery", hint: "Pay when your food arrives" },
  { value: "UPI_SIMULATED", label: "UPI (Simulated)", hint: "Simulated UPI — no real payment" },
  { value: "CARD_SIMULATED", label: "Card (Simulated)", hint: "Simulated card — no real payment" },
];

const TAX_RATE = 0.05;

export default function CheckoutPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [cart, setCart] = useState<CartData | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  // The cart API returns only restaurantId, so the delivery fee and
  // restaurant name are fetched from the restaurant itself.
  const [fetchedDeliveryFee, setFetchedDeliveryFee] = useState<number | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [instructions, setInstructions] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ discount: number; message?: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [placing, setPlacing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "", pincode: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cartRes, addrRes] = await Promise.all([fetch("/api/cart"), fetch("/api/addresses")]);
      if (cartRes.status === 401 || addrRes.status === 401) {
        router.push("/login");
        return;
      }
      const [cartData, addrData] = await Promise.all([
        cartRes.ok ? cartRes.json().catch(() => null) : null,
        addrRes.ok ? addrRes.json().catch(() => null) : null,
      ]);
      const cartObj = unwrapObject<CartData>(cartData, "cart");
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
      }
      const list = unwrapArray<Address>(addrData, "addresses");
      setAddresses(list);
      const def = list.find((a) => a.is_default) ?? list[0];
      if (def) setAddressId(def.id);
    } catch {
      pushToast("Could not load checkout details.", "error");
    } finally {
      setLoading(false);
    }
  }, [router, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const items = cart?.items ?? [];
  const serverSubtotal = num(cart?.subtotal, -1);
  const computedSubtotal = items.reduce((sum, item) => sum + cartItemLineTotal(item), 0);
  const subtotal = serverSubtotal >= 0 ? serverSubtotal : computedSubtotal;
  const serverDelivery = num(cart?.delivery_fee ?? cart?.deliveryFee, -1);
  const deliveryFee =
    serverDelivery >= 0 ? serverDelivery : (fetchedDeliveryFee ?? 29);
  const serverTax = num(cart?.tax_amount ?? cart?.tax, -1);
  const tax = serverTax >= 0 ? serverTax : subtotal * TAX_RATE;
  const discount = coupon?.discount ?? num(cart?.discount_amount, 0);
  const total = Math.max(0, subtotal + deliveryFee + tax - discount);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === addressId) ?? null,
    [addresses, addressId],
  );

  const validateCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code first.");
      return;
    }
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCoupon(null);
        setCouponError(data?.error || data?.message || "This coupon is not valid for your order.");
        return;
      }
      const discountValue = num(
        data?.discount ?? data?.discount_amount ?? data?.discountAmount ?? data?.coupon?.discount,
        0,
      );
      setCoupon({ discount: discountValue, message: data?.message });
      pushToast(`Coupon ${code} applied — you save ${formatINR(discountValue)}.`, "success");
    } catch {
      setCouponError("Could not validate the coupon. Try again.");
    } finally {
      setValidatingCoupon(false);
    }
  };

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
      const created = unwrapObject<Address>(data, "address");
      await load();
      if (created) setAddressId(created.id);
      setShowAddressForm(false);
      setForm({ label: "Home", line1: "", line2: "", city: "", pincode: "" });
      pushToast("Address saved.", "success");
    } catch {
      setFormError("Could not save the address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const placeOrder = async () => {
    if (!addressId) {
      pushToast("Add and select a delivery address first.", "error");
      return;
    }
    if (items.length === 0) {
      pushToast("Your cart is empty.", "error");
      return;
    }
    setPlacing(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId,
          couponCode: coupon ? couponCode.trim().toUpperCase() : undefined,
          instructions: instructions.trim() || undefined,
          paymentMethod,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        pushToast(data?.error || data?.message || "Could not place the order.", "error");
        return;
      }
      const orderId = data?.orderId ?? data?.order?.id ?? data?.id;
      window.dispatchEvent(new Event("foodflow:cart-updated"));
      pushToast("Order placed!", "success");
      if (orderId) router.push(`/orders/${orderId}`);
      else router.push("/orders");
    } catch {
      pushToast("Could not place the order. Try again.", "error");
    } finally {
      setPlacing(false);
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

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Nothing to check out</h1>
        <p className="mt-2 text-sm text-stone-500">Your cart is empty.</p>
        <Link href="/restaurants" className="btn-primary mt-6">Browse restaurants</Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl dark:text-white">Checkout</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
        <ShieldCheck className="h-4 w-4" /> SIMULATED — no real money will be charged.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:col-span-2">
          {/* Address */}
          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
              <MapPin className="h-5 w-5 text-brand-500" /> Delivery address
            </h2>
            {addresses.length === 0 && !showAddressForm ? (
              <p className="mt-3 text-sm text-stone-500">No saved addresses yet — add one below.</p>
            ) : (
              <div className="mt-4 space-y-2" role="radiogroup" aria-label="Delivery address">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition ${
                      addressId === address.id
                        ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-900/20"
                        : "border-stone-200 hover:border-stone-300 dark:border-stone-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-1 h-4 w-4 accent-brand-500"
                    />
                    <span>
                      <span className="font-semibold text-stone-900 dark:text-white">
                        {address.label}
                        {address.is_default ? " · Default" : ""}
                      </span>
                      <span className="block text-stone-500 dark:text-stone-400">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}, {address.city} {address.pincode}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowAddressForm((v) => !v)} className="btn-secondary mt-4">
              <Plus className="h-4 w-4" /> {showAddressForm ? "Hide address form" : "Add a new address"}
            </button>
            {showAddressForm && (
              <form onSubmit={saveAddress} className="mt-4 space-y-3 border-t border-stone-100 pt-4 dark:border-stone-800">
                {formError && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="addr-label" className="label">Label</label>
                    <select id="addr-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input">
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="addr-pincode" className="label">Pincode</label>
                    <input id="addr-pincode" inputMode="numeric" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="560001" className="input" />
                  </div>
                </div>
                <div>
                  <label htmlFor="addr-line1" className="label">Street address</label>
                  <input id="addr-line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Flat / house no., street" className="input" />
                </div>
                <div>
                  <label htmlFor="addr-line2" className="label">Landmark (optional)</label>
                  <input id="addr-line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Near…" className="input" />
                </div>
                <div>
                  <label htmlFor="addr-city" className="label">City</label>
                  <input id="addr-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" className="input" />
                </div>
                <button type="submit" disabled={savingAddress} className="btn-primary">
                  {savingAddress ? "Saving…" : "Save address"}
                </button>
              </form>
            )}
          </section>

          {/* Instructions */}
          <section className="card p-5 sm:p-6">
            <label htmlFor="instructions" className="text-lg font-bold text-stone-900 dark:text-white">
              Delivery instructions (optional)
            </label>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="e.g. Ring the bell twice, leave at the gate…"
              className="input mt-3 resize-none"
            />
          </section>

          {/* Coupon */}
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Coupon</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null); setCouponError(null); }}
                placeholder="Enter coupon code"
                aria-label="Coupon code"
                className="input uppercase"
              />
              <button type="button" onClick={validateCoupon} disabled={validatingCoupon} className="btn-secondary shrink-0">
                {validatingCoupon ? "Checking…" : "Apply"}
              </button>
            </div>
            {couponError && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{couponError}</p>}
            {coupon && (
              <p className="mt-2 text-sm font-medium text-emerald-600">
                Coupon applied — you save {formatINR(coupon.discount)}.
                {coupon.message ? ` ${coupon.message}` : ""}
              </p>
            )}
          </section>

          {/* Payment */}
          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Payment method</h2>
            <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
              SIMULATED — no real money will be charged for any option.
            </p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Payment method">
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition ${
                    paymentMethod === option.value
                      ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-900/20"
                      : "border-stone-200 hover:border-stone-300 dark:border-stone-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    className="mt-1 h-4 w-4 accent-brand-500"
                  />
                  <span>
                    <span className="font-semibold text-stone-900 dark:text-white">{option.label}</span>
                    <span className="block text-stone-500 dark:text-stone-400">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </motion.div>

        {/* Summary */}
        <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">Order summary</h2>
          {restaurantName && (
            <p className="mt-1 text-sm text-stone-500">{restaurantName}</p>
          )}
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id ?? item.foodItemId ?? item.food_item_id} className="flex justify-between gap-3">
                <span className="text-stone-600 dark:text-stone-300">
                  {cartItemName(item)} × {item.qty}
                </span>
                <span className="font-medium">{formatINR(cartItemLineTotal(item))}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm dark:border-stone-800">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{formatINR(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Delivery fee</dt><dd className="font-medium">{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Tax (5%)</dt><dd className="font-medium">{formatINR(tax)}</dd></div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600"><dt>Coupon discount</dt><dd className="font-medium">−{formatINR(discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-stone-100 pt-3 text-base font-bold dark:border-stone-800">
              <dt>Total</dt><dd>{formatINR(total)}</dd>
            </div>
          </dl>
          {selectedAddress && (
            <p className="mt-4 rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              Deliver to: {selectedAddress.label} — {selectedAddress.line1}, {selectedAddress.city} {selectedAddress.pincode}
            </p>
          )}
          <button type="button" onClick={placeOrder} disabled={placing || !addressId} className="btn-primary mt-5 w-full">
            {placing ? "Placing order…" : `Place order · ${formatINR(total)}`}
          </button>
          {!addressId && <p className="mt-2 text-center text-xs text-stone-500">Select a delivery address to place your order.</p>}
        </aside>
      </div>
    </div>
  );
}
