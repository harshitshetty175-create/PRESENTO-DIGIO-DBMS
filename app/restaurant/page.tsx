"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  IndianRupee,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatINR, canTransition } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";

type Stats = {
  restaurants: { id: number; name: string; city: string; is_open: boolean }[];
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  avgOrderValue: number;
  popularItems: { foodItemId: number | null; name: string; qty: number; revenue: number }[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
};

type OrderRow = {
  id: number;
  status: string;
  total_amount: number;
  placed_at: string;
  user: { name: string; email: string; phone: string | null };
  restaurant: { id: number; name: string };
  items: { id: number; item_name: string; qty: number; unit_price: number }[];
};

type InventoryRow = {
  foodItemId: number;
  foodName: string;
  restaurantName: string;
  category: string;
  price: number;
  stockQty: number;
  lowStockAt: number;
  isLowStock: boolean;
  isAvailable: boolean;
};

type FoodRow = {
  id: number;
  name: string;
  price: number;
  category_id: number;
  restaurant_id: number;
  veg_type: string;
  is_available: boolean;
  description?: string | null;
};

type Category = { id: number; name: string };

const PIE_COLORS = ["#f97316", "#ea580c", "#fdba74", "#c2410c", "#fed7aa"];
const ORDER_ACTIONS: { label: string; status: string; className: string }[] = [
  { label: "Accept", status: "CONFIRMED", className: "bg-emerald-600 text-white" },
  { label: "Reject", status: "REJECTED", className: "bg-red-600 text-white" },
  { label: "Preparing", status: "PREPARING", className: "bg-amber-600 text-white" },
  { label: "Ready", status: "READY_FOR_PICKUP", className: "bg-blue-600 text-white" },
];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  return res;
}

export default function RestaurantDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "menu" | "inventory" | "analytics">("orders");
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderStatus, setOrderStatus] = useState("");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Food form
  const [form, setForm] = useState({
    name: "",
    price: "",
    category_id: "",
    veg_type: "VEG",
    description: "",
    is_available: true,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});

  const kickToLogin = useCallback(
    (res: Response) => {
      if (res.status === 401) router.push("/login");
    },
    [router]
  );

  const loadStats = useCallback(async () => {
    const res = await api("/api/restaurant/stats");
    kickToLogin(res);
    if (res.ok) setStats(await res.json());
  }, [kickToLogin]);

  const loadOrders = useCallback(async () => {
    const q = new URLSearchParams({ page: String(orderPage) });
    if (orderStatus) q.set("status", orderStatus);
    const res = await api(`/api/restaurant/orders?${q}`);
    kickToLogin(res);
    if (res.ok) {
      const d = await res.json();
      setOrders(d.orders ?? []);
      setOrderTotalPages(d.totalPages ?? 1);
    }
  }, [kickToLogin, orderPage, orderStatus]);

  const loadInventory = useCallback(async () => {
    const res = await api("/api/restaurant/inventory");
    kickToLogin(res);
    if (res.ok) {
      const d = await res.json();
      setInventory(d.inventory ?? []);
    }
  }, [kickToLogin]);

  const loadMenu = useCallback(async () => {
    const [foodsRes, catsRes] = await Promise.all([
      api(
        selectedRestaurant
          ? `/api/foods?restaurantId=${selectedRestaurant}&available=false`
          : "/api/foods?available=false"
      ),
      api("/api/categories"),
    ]);
    kickToLogin(foodsRes);
    if (foodsRes.ok) {
      const d = await foodsRes.json();
      const list: FoodRow[] = Array.isArray(d) ? d : (d.foods ?? d.items ?? []);
      setFoods(
        selectedRestaurant
          ? list.filter((f) => f.restaurant_id === selectedRestaurant)
          : list
      );
    }
    if (catsRes.ok) {
      const d = await catsRes.json();
      setCategories(Array.isArray(d) ? d : (d.categories ?? []));
    }
  }, [kickToLogin, selectedRestaurant]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadOrders(), loadInventory(), loadMenu()]);
      setLoading(false);
    })().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  async function changeOrderStatus(orderId: number, status: string) {
    setError("");
    setNotice("");
    const res = await api(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update order");
      return;
    }
    setNotice(`Order #${orderId} → ${status}`);
    await Promise.all([loadOrders(), loadStats()]);
  }

  async function saveFood(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const restaurantId =
      selectedRestaurant || stats?.restaurants[0]?.id;
    if (!restaurantId) {
      setError("No restaurant found for your account yet.");
      return;
    }
    // Core food API: POST uses the camelCase foodSchema (restaurantId,
    // categoryId); PATCH uses the snake_case foodPatchSchema (category_id).
    const payload = editingId
      ? {
          name: form.name.trim(),
          price: Number(form.price),
          category_id: Number(form.category_id),
          veg_type: form.veg_type,
          description: form.description.trim() || undefined,
          is_available: form.is_available,
          is_veg: form.veg_type !== "NON_VEG",
        }
      : {
          name: form.name.trim(),
          price: Number(form.price),
          categoryId: Number(form.category_id),
          restaurantId,
          veg_type: form.veg_type,
          description: form.description.trim() || undefined,
          is_veg: form.veg_type !== "NON_VEG",
        };
    const res = await api(
      editingId ? `/api/foods/${editingId}` : "/api/foods",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save food item");
      return;
    }
    setNotice(editingId ? "Menu item updated" : "Menu item added");
    setForm({ name: "", price: "", category_id: "", veg_type: "VEG", description: "", is_available: true });
    setEditingId(null);
    await Promise.all([loadMenu(), loadInventory(), loadStats()]);
  }

  async function deleteFood(id: number) {
    if (!confirm("Delete this menu item?")) return;
    const res = await api(`/api/foods/${id}`, { method: "DELETE" });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not delete food item");
      return;
    }
    setNotice("Menu item deleted");
    await Promise.all([loadMenu(), loadInventory()]);
  }

  function startEdit(f: FoodRow) {
    setEditingId(f.id);
    setForm({
      name: f.name,
      price: String(f.price),
      category_id: String(f.category_id),
      veg_type: f.veg_type,
      description: f.description ?? "",
      is_available: f.is_available,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveStock(foodItemId: number) {
    const val = stockDraft[foodItemId];
    if (val === undefined || val === "") return;
    const res = await api("/api/restaurant/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId, stockQty: Number(val) }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update stock");
      return;
    }
    setNotice("Stock updated");
    setStockDraft((s) => {
      const next = { ...s };
      delete next[foodItemId];
      return next;
    });
    await loadInventory();
  }

  const lowStock = inventory.filter((i) => i.isLowStock);

  if (loading) {
    return <main className="mx-auto max-w-6xl p-6">Loading restaurant dashboard…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Restaurant Dashboard</h1>
        <p className="text-sm text-stone-500">
          {stats?.restaurants.map((r) => r.name).join(", ") || "Your restaurants"}
        </p>
        {stats && stats.restaurants.length > 1 ? (
          <select
            value={selectedRestaurant}
            onChange={(e) =>
              setSelectedRestaurant(e.target.value ? Number(e.target.value) : "")
            }
            className="mt-3 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All restaurants</option>
            {stats.restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.city})
              </option>
            ))}
          </select>
        ) : null}
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Total orders" value={String(stats?.totalOrders ?? 0)} icon={<ShoppingBag size={20} />} />
        <StatCard title="Pending orders" value={String(stats?.pendingOrders ?? 0)} sub="Placed → out for delivery" icon={<Clock size={20} />} />
        <StatCard title="Completed" value={String(stats?.completedOrders ?? 0)} sub={`${stats?.cancelledOrders ?? 0} cancelled / rejected`} icon={<CheckCircle2 size={20} />} />
        <StatCard title="Revenue (delivered)" value={formatINR(stats?.revenue ?? 0)} sub={`Avg order ${formatINR(stats?.avgOrderValue ?? 0)}`} icon={<IndianRupee size={20} />} />
      </div>

      {lowStock.length > 0 ? (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            Low stock:{" "}
            {lowStock.map((i) => `${i.foodName} (${i.stockQty} left)`).join(", ")}
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["orders", "menu", "inventory", "analytics"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-brand-600 text-white" : "bg-white text-stone-700 border border-stone-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "orders" ? (
          <section>
            <div className="mb-3 flex gap-2">
              <select
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value);
                  setOrderPage(1);
                }}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <DataTable<OrderRow>
              columns={[
                { key: "id", label: "Order", render: (r) => `#${r.id}` },
                {
                  key: "customer",
                  label: "Customer",
                  render: (r) => (
                    <span>
                      {r.user?.name}
                      <br />
                      <span className="text-xs text-stone-500">{r.user?.email}</span>
                    </span>
                  ),
                },
                {
                  key: "items",
                  label: "Items",
                  render: (r) =>
                    r.items?.map((i) => `${i.qty}× ${i.item_name}`).join(", "),
                },
                { key: "total_amount", label: "Total", render: (r) => formatINR(r.total_amount) },
                { key: "status", label: "Status", render: (r) => <span className="font-semibold">{r.status}</span> },
                { key: "placed_at", label: "Placed", render: (r) => new Date(r.placed_at).toLocaleString() },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <span className="flex flex-wrap gap-1">
                      {ORDER_ACTIONS.map((a) => {
                        const allowed = canTransition(
                          r.status as OrderStatus,
                          a.status as OrderStatus
                        );
                        return (
                          <button
                            key={a.status}
                            type="button"
                            disabled={!allowed}
                            title={
                              allowed
                                ? undefined
                                : `Cannot move from ${r.status} to ${a.status}`
                            }
                            onClick={() => changeOrderStatus(r.id, a.status)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.className} disabled:cursor-not-allowed disabled:opacity-30`}
                          >
                            {a.label}
                          </button>
                        );
                      })}
                    </span>
                  ),
                },
              ]}
              data={orders}
              page={orderPage}
              totalPages={orderTotalPages}
              onPageChange={setOrderPage}
              emptyText="No orders yet."
            />
          </section>
        ) : null}

        {tab === "menu" ? (
          <section className="space-y-6">
            <form onSubmit={saveFood} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Plus size={18} /> {editingId ? `Edit item #${editingId}` : "Add menu item"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price (₹)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select value={form.veg_type} onChange={(e) => setForm({ ...form, veg_type: e.target.value })} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                  <option value="VEG">Veg</option>
                  <option value="NON_VEG">Non-veg</option>
                  <option value="VEGAN">Vegan</option>
                </select>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm sm:col-span-2" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
                  Available for ordering
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
                  {editingId ? "Save changes" : "Add item"}
                </button>
                {editingId ? (
                  <button type="button" onClick={() => { setEditingId(null); setForm({ name: "", price: "", category_id: "", veg_type: "VEG", description: "", is_available: true }); }} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <DataTable<FoodRow>
              columns={[
                { key: "name", label: "Item" },
                { key: "price", label: "Price", render: (r) => formatINR(r.price) },
                { key: "veg_type", label: "Type" },
                { key: "is_available", label: "Available", render: (r) => (r.is_available ? "Yes" : "No") },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <span className="flex gap-2">
                      <button type="button" onClick={() => startEdit(r)} className="inline-flex items-center gap-1 text-brand-700"><Pencil size={14} /> Edit</button>
                      <button type="button" onClick={() => deleteFood(r.id)} className="inline-flex items-center gap-1 text-red-600"><Trash2 size={14} /> Delete</button>
                    </span>
                  ),
                },
              ]}
              data={foods}
              emptyText="No menu items yet — add your first dish above."
            />
          </section>
        ) : null}

        {tab === "inventory" ? (
          <section>
            <DataTable<InventoryRow>
              columns={[
                { key: "foodName", label: "Item" },
                { key: "restaurantName", label: "Restaurant" },
                { key: "category", label: "Category" },
                { key: "price", label: "Price", render: (r) => formatINR(r.price) },
                {
                  key: "stockQty",
                  label: "Stock",
                  render: (r) => (
                    <span className={r.isLowStock ? "font-bold text-red-600" : ""}>
                      {r.stockQty} {r.isLowStock ? "— LOW" : ""}
                    </span>
                  ),
                },
                { key: "lowStockAt", label: "Low at" },
                {
                  key: "edit",
                  label: "Update stock",
                  render: (r) => (
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={stockDraft[r.foodItemId] ?? String(r.stockQty)}
                        onChange={(e) =>
                          setStockDraft((s) => ({ ...s, [r.foodItemId]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-sm"
                        aria-label={`Stock for ${r.foodName}`}
                      />
                      <button
                        type="button"
                        onClick={() => saveStock(r.foodItemId)}
                        className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white"
                      >
                        Save
                      </button>
                    </span>
                  ),
                },
              ]}
              data={inventory}
              emptyText="No inventory rows yet."
            />
          </section>
        ) : null}

        {tab === "analytics" ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Daily revenue — last 14 days</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.dailyRevenue ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis />
                    <Tooltip formatter={(v) => formatINR(Number(v))} />
                    <Bar dataKey="revenue" fill="#f97316" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Popular items — top 5 by quantity</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.popularItems ?? []}
                      dataKey="qty"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {(stats?.popularItems ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-stone-600">
                {(stats?.popularItems ?? []).map((p) => (
                  <li key={p.name} className="flex justify-between">
                    <span>{p.name}</span>
                    <span>{p.qty} sold · {formatINR(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </motion.div>
    </main>
  );
}
