"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
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
import { Users, Store, Bike, UtensilsCrossed, ShoppingBag, IndianRupee } from "lucide-react";
import { formatINR } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";

type Overview = {
  counts: { customers: number; restaurants: number; partners: number; foodItems: number; orders: number };
  completedOrders: number;
  cancelledOrders: number;
  grossOrderValue: number;
  successfulPayments: { count: number; total: number };
  dailyOrders: { date: string; orders: number; revenue: number }[];
  monthlyRevenue: { month: string; revenue: number; orders: number }[];
  statusDistribution: { status: string; count: number }[];
  topRestaurants: { restaurantId: number; name: string; city: string; orders: number; revenue: number }[];
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  _count: { orders: number; restaurants: number };
};

type RestaurantRow = {
  id: number;
  name: string;
  city: string;
  cuisine: string;
  is_active: boolean;
  is_open: boolean;
  rating: number;
};

type OrderRow = {
  id: number;
  status: string;
  total_amount: number;
  placed_at: string;
  restaurant?: { name: string };
  address?: { city: string; pincode: string } | null;
  payments?: { id: number; amount: number; method: string; status: string; created_at: string }[];
};

type CouponRow = {
  id: number;
  code: string;
  discount_percent: number;
  max_discount: number;
  min_order: number;
  is_active: boolean;
  valid_to: string | null;
  _count?: { usages: number };
};

type AuditRow = {
  id: number;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
  user: { email: string; name: string } | null;
};

const PIE_COLORS = ["#f97316", "#ea580c", "#fdba74", "#c2410c", "#78716c", "#a8a29e", "#292524", "#fb923c", "#ffedd5"];

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "restaurants" | "orders" | "payments" | "coupons" | "audit">("users");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState("");
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderStatus, setOrderStatus] = useState("");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditQuery, setAuditQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discount_percent: "",
    max_discount: "",
    min_order: "",
    valid_to: "",
  });

  const kick = useCallback(
    (res: Response) => {
      if (res.status === 401) router.push("/login");
      if (res.status === 403) setError("This page is for super admins only.");
    },
    [router]
  );

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/overview");
    kick(res);
    if (res.ok) setOverview(await res.json());
  }, [kick]);

  const loadUsers = useCallback(async () => {
    const q = new URLSearchParams({ page: String(userPage) });
    if (userQuery.trim()) q.set("q", userQuery.trim());
    if (userRole) q.set("role", userRole);
    const res = await fetch(`/api/admin/users?${q}`);
    kick(res);
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
      setUserTotalPages(d.totalPages ?? 1);
    }
  }, [kick, userPage, userQuery, userRole]);

  const loadRestaurants = useCallback(async () => {
    const res = await fetch("/api/restaurants?limit=100&includeInactive=1");
    kick(res);
    if (res.ok) {
      const d = await res.json();
      setRestaurants(Array.isArray(d) ? d : (d.restaurants ?? []));
    }
  }, [kick]);

  const loadOrders = useCallback(async () => {
    const q = new URLSearchParams({ page: String(orderPage), limit: "20" });
    if (orderStatus) q.set("status", orderStatus);
    const res = await fetch(`/api/orders?${q}`);
    kick(res);
    if (res.ok) {
      const d = await res.json();
      const list: OrderRow[] = Array.isArray(d) ? d : (d.orders ?? []);
      setOrders(list);
      setOrderTotalPages(d.totalPages ?? 1);
    }
  }, [kick, orderPage, orderStatus]);

  const loadCoupons = useCallback(async () => {
    const res = await fetch("/api/admin/coupons");
    kick(res);
    if (res.ok) {
      const d = await res.json();
      setCoupons(d.coupons ?? []);
    }
  }, [kick]);

  const loadAudit = useCallback(async () => {
    const q = new URLSearchParams({ page: String(auditPage) });
    if (auditQuery.trim()) q.set("q", auditQuery.trim());
    const res = await fetch(`/api/admin/audit-logs?${q}`);
    kick(res);
    if (res.ok) {
      const d = await res.json();
      setAuditLogs(d.logs ?? []);
      setAuditTotalPages(d.totalPages ?? 1);
    }
  }, [kick, auditPage, auditQuery]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadOverview(), loadUsers(), loadRestaurants(), loadOrders(), loadCoupons(), loadAudit()]);
      setLoading(false);
    })().catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load admin dashboard");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  async function toggleUser(u: UserRow) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update user");
      return;
    }
    setNotice(`User ${u.email} ${u.is_active ? "deactivated" : "activated"}`);
    await loadUsers();
  }

  async function toggleRestaurant(r: RestaurantRow) {
    const res = await fetch(`/api/restaurants/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !r.is_active }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update restaurant");
      return;
    }
    setNotice(`Restaurant ${r.name} ${r.is_active ? "deactivated" : "activated"}`);
    await loadRestaurants();
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponForm.code,
        description: couponForm.description || undefined,
        discount_percent: Number(couponForm.discount_percent),
        max_discount: Number(couponForm.max_discount || 0),
        min_order: Number(couponForm.min_order || 0),
        valid_to: couponForm.valid_to || undefined,
      }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not create coupon");
      return;
    }
    setNotice(`Coupon ${couponForm.code.toUpperCase()} created`);
    setCouponForm({ code: "", description: "", discount_percent: "", max_discount: "", min_order: "", valid_to: "" });
    await loadCoupons();
  }

  const payments = orders.flatMap((o) =>
    (o.payments ?? []).map((p) => ({ ...p, orderId: o.id, orderStatus: o.status }))
  );

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6">Loading admin dashboard…</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-bold text-ink sm:text-3xl">Admin Dashboard</h1>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Customers" value={String(overview?.counts.customers ?? 0)} icon={<Users size={20} />} />
        <StatCard title="Restaurants" value={String(overview?.counts.restaurants ?? 0)} icon={<Store size={20} />} />
        <StatCard title="Partners" value={String(overview?.counts.partners ?? 0)} icon={<Bike size={20} />} />
        <StatCard title="Food items" value={String(overview?.counts.foodItems ?? 0)} icon={<UtensilsCrossed size={20} />} />
        <StatCard title="Orders" value={String(overview?.counts.orders ?? 0)} sub={`${overview?.completedOrders ?? 0} delivered · ${overview?.cancelledOrders ?? 0} cancelled`} icon={<ShoppingBag size={20} />} />
        <StatCard title="Gross order value" value={formatINR(overview?.grossOrderValue ?? 0)} sub={`${overview?.successfulPayments.count ?? 0} successful payments · ${formatINR(overview?.successfulPayments.total ?? 0)}`} icon={<IndianRupee size={20} />} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Daily orders — last 14 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview?.dailyOrders ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#ea580c" strokeWidth={2} name="Orders" />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} name="Revenue (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
          <h2 className="mb-3 font-semibold">Order status distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={overview?.statusDistribution ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={85} label>
                  {(overview?.statusDistribution ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Monthly revenue — last 6 months</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.monthlyRevenue ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Bar dataKey="revenue" fill="#f97316" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
          <h2 className="mb-3 font-semibold">Top restaurants</h2>
          <ul className="space-y-2 text-sm">
            {(overview?.topRestaurants ?? []).map((r) => (
              <li key={r.restaurantId} className="flex justify-between gap-2">
                <span>{r.name} <span className="text-stone-400">({r.city})</span></span>
                <span className="font-medium">{r.orders} orders · {formatINR(r.revenue)}</span>
              </li>
            ))}
            {(overview?.topRestaurants ?? []).length === 0 ? (
              <li className="text-stone-500">No orders yet.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["users", "restaurants", "orders", "payments", "coupons", "audit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-brand-600 text-white" : "border border-stone-300 bg-white text-stone-700"
            }`}
          >
            {t === "audit" ? "Audit logs" : t}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "users" ? (
          <section>
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                value={userQuery}
                onChange={(e) => { setUserQuery(e.target.value); setUserPage(1); }}
                placeholder="Search name, email or phone…"
                className="min-w-[220px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              <select value={userRole} onChange={(e) => { setUserRole(e.target.value); setUserPage(1); }} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">All roles</option>
                <option value="CUSTOMER">Customer</option>
                <option value="RESTAURANT_ADMIN">Restaurant admin</option>
                <option value="DELIVERY_PARTNER">Delivery partner</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </div>
            <DataTable<UserRow>
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "role", label: "Role" },
                { key: "orders", label: "Orders", render: (r) => String(r._count?.orders ?? 0) },
                { key: "is_active", label: "Active", render: (r) => (r.is_active ? "Yes" : "No") },
                { key: "created_at", label: "Joined", render: (r) => new Date(r.created_at).toLocaleDateString() },
                {
                  key: "toggle",
                  label: "",
                  render: (r) => (
                    <button type="button" onClick={() => toggleUser(r)} className={`rounded-full px-3 py-1 text-xs font-medium ${r.is_active ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {r.is_active ? "Deactivate" : "Activate"}
                    </button>
                  ),
                },
              ]}
              data={users}
              page={userPage}
              totalPages={userTotalPages}
              onPageChange={setUserPage}
              emptyText="No users match."
            />
          </section>
        ) : null}

        {tab === "restaurants" ? (
          <section>
            <DataTable<RestaurantRow>
              columns={[
                { key: "name", label: "Restaurant" },
                { key: "city", label: "City" },
                { key: "cuisine", label: "Cuisine" },
                { key: "rating", label: "Rating", render: (r) => Number(r.rating).toFixed(1) },
                { key: "is_open", label: "Open", render: (r) => (r.is_open ? "Yes" : "No") },
                { key: "is_active", label: "Active", render: (r) => (r.is_active ? "Yes" : "No") },
                {
                  key: "toggle",
                  label: "",
                  render: (r) => (
                    <button type="button" onClick={() => toggleRestaurant(r)} className={`rounded-full px-3 py-1 text-xs font-medium ${r.is_active ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {r.is_active ? "Deactivate" : "Activate"}
                    </button>
                  ),
                },
              ]}
              data={restaurants}
              emptyText="No restaurants yet."
            />
          </section>
        ) : null}

        {tab === "orders" ? (
          <section>
            <div className="mb-3 flex gap-2">
              <select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setOrderPage(1); }} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                <option value="">All statuses</option>
                {["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REJECTED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <DataTable<OrderRow>
              columns={[
                { key: "id", label: "Order", render: (r) => `#${r.id}` },
                // NOTE: core GET /api/orders does not include the customer
                // user, so the delivery address is shown instead.
                { key: "deliverTo", label: "Deliver to", render: (r) => r.address ? `${r.address.city} ${r.address.pincode}` : "—" },
                { key: "restaurant", label: "Restaurant", render: (r) => r.restaurant?.name ?? "—" },
                { key: "total_amount", label: "Total", render: (r) => formatINR(r.total_amount) },
                { key: "status", label: "Status", render: (r) => <span className="font-semibold">{r.status}</span> },
                { key: "placed_at", label: "Placed", render: (r) => new Date(r.placed_at).toLocaleString() },
              ]}
              data={orders}
              page={orderPage}
              totalPages={orderTotalPages}
              onPageChange={setOrderPage}
              emptyText="No orders yet."
            />
          </section>
        ) : null}

        {tab === "payments" ? (
          <section>
            <p className="mb-3 text-sm text-stone-500">
              Payments attached to the loaded orders (page {orderPage}). Successful payments overall:{" "}
              {overview?.successfulPayments.count ?? 0} · {formatINR(overview?.successfulPayments.total ?? 0)}.
            </p>
            <DataTable<(typeof payments)[number]>
              columns={[
                { key: "id", label: "Payment", render: (r) => `#${r.id}` },
                { key: "orderId", label: "Order", render: (r) => `#${r.orderId}` },
                { key: "amount", label: "Amount", render: (r) => formatINR(r.amount) },
                { key: "method", label: "Method" },
                { key: "status", label: "Status", render: (r) => <span className="font-semibold">{r.status}</span> },
                { key: "created_at", label: "When", render: (r) => new Date(r.created_at).toLocaleString() },
              ]}
              data={payments}
              emptyText="No payments on the loaded orders. (Payments come from /api/orders; if the core orders API does not include them, this table stays empty.)"
            />
          </section>
        ) : null}

        {tab === "coupons" ? (
          <section className="space-y-6">
            <form onSubmit={createCoupon} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <h2 className="mb-3 font-semibold">Create coupon</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <input required value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} placeholder="Code (e.g. WELCOME20)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm uppercase" />
                <input required type="number" min="1" max="100" step="0.01" value={couponForm.discount_percent} onChange={(e) => setCouponForm({ ...couponForm, discount_percent: e.target.value })} placeholder="Discount %" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                <input type="number" min="0" step="0.01" value={couponForm.max_discount} onChange={(e) => setCouponForm({ ...couponForm, max_discount: e.target.value })} placeholder="Max discount ₹ (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                <input type="number" min="0" step="0.01" value={couponForm.min_order} onChange={(e) => setCouponForm({ ...couponForm, min_order: e.target.value })} placeholder="Min order ₹ (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                <input type="date" value={couponForm.valid_to} onChange={(e) => setCouponForm({ ...couponForm, valid_to: e.target.value })} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" aria-label="Valid until" />
                <input value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} placeholder="Description (optional)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Create coupon</button>
            </form>
            <DataTable<CouponRow>
              columns={[
                { key: "code", label: "Code" },
                { key: "discount_percent", label: "Discount", render: (r) => `${Number(r.discount_percent)}%` },
                { key: "max_discount", label: "Max discount", render: (r) => formatINR(r.max_discount) },
                { key: "min_order", label: "Min order", render: (r) => formatINR(r.min_order) },
                { key: "usages", label: "Used", render: (r) => String(r._count?.usages ?? 0) },
                { key: "is_active", label: "Active", render: (r) => (r.is_active ? "Yes" : "No") },
                { key: "valid_to", label: "Valid to", render: (r) => (r.valid_to ? new Date(r.valid_to).toLocaleDateString() : "—") },
              ]}
              data={coupons}
              emptyText="No coupons yet."
            />
          </section>
        ) : null}

        {tab === "audit" ? (
          <section>
            <div className="mb-3 flex gap-2">
              <input
                value={auditQuery}
                onChange={(e) => { setAuditQuery(e.target.value); setAuditPage(1); }}
                placeholder="Search action or details…"
                className="min-w-[220px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <DataTable<AuditRow>
              columns={[
                { key: "created_at", label: "When", render: (r) => new Date(r.created_at).toLocaleString() },
                { key: "user", label: "User", render: (r) => r.user?.email ?? "system" },
                { key: "action", label: "Action" },
                { key: "entity", label: "Entity", render: (r) => `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ""}` },
                { key: "details", label: "Details", render: (r) => r.details ?? "—" },
              ]}
              data={auditLogs}
              page={auditPage}
              totalPages={auditTotalPages}
              onPageChange={setAuditPage}
              emptyText="No audit log entries yet."
            />
          </section>
        ) : null}
      </motion.div>
    </main>
  );
}
