"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bike, PackageCheck, Clock, MapPin } from "lucide-react";
import { formatINR } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";

type OrderInfo = {
  id: number;
  status: string;
  total_amount: number;
  placed_at: string;
  restaurant: { name: string; address: string; city: string; phone: string | null };
  user: { name: string; phone: string | null };
  address: { line1: string; line2: string | null; city: string; pincode: string } | null;
  items: { item_name: string; qty: number; unit_price: number }[];
};

type DeliveryRow = {
  id: number;
  status: string;
  assigned_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  order: OrderInfo;
};

type AvailableRow = {
  deliveryId: number | null;
  orderId: number;
  status: string;
  order: OrderInfo;
};

type Partner = {
  id: number;
  vehicle_type: string;
  vehicle_no: string | null;
  is_available: boolean;
  is_active: boolean;
  rating: number;
};

const NEXT_ACTION: Record<string, { label: string; status: string } | null> = {
  ASSIGNED: { label: "Accept", status: "ACCEPTED" },
  ACCEPTED: { label: "Pick up", status: "PICKED_UP" },
  PICKED_UP: { label: "Out for delivery", status: "OUT_FOR_DELIVERY" },
  OUT_FOR_DELIVERY: { label: "Delivered", status: "DELIVERED" },
  DELIVERED: null,
  CANCELLED: null,
};

export default function DeliveryDashboard() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [assigned, setAssigned] = useState<DeliveryRow[]>([]);
  const [available, setAvailable] = useState<AvailableRow[]>([]);
  const [history, setHistory] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [assignedRes, profileRes] = await Promise.all([
      fetch("/api/delivery/assigned"),
      fetch("/api/delivery/profile"),
    ]);
    if (assignedRes.status === 401 || profileRes.status === 401) {
      router.push("/login");
      return;
    }
    if (assignedRes.ok) {
      const d = await assignedRes.json();
      setAssigned(d.assigned ?? []);
      setAvailable(d.available ?? []);
      setHistory(d.history ?? []);
    }
    if (profileRes.ok) {
      const d = await profileRes.json();
      setPartner(d.partner ?? null);
    }
  }, [router]);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function toggleAvailability() {
    const next = !(partner?.is_available ?? true);
    const res = await fetch("/api/delivery/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: next }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update availability");
      return;
    }
    const d = await res.json();
    setPartner(d.partner);
    setNotice(next ? "You are now available for deliveries" : "You are now offline");
  }

  async function advance(deliveryId: number, status: string) {
    setError("");
    const res = await fetch(`/api/delivery/${deliveryId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not update delivery");
      return;
    }
    setNotice(`Delivery → ${status.replaceAll("_", " ")}`);
    await load();
  }

  async function claim(orderId: number) {
    setError("");
    const res = await fetch("/api/delivery/assigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    if (res.status === 401) return router.push("/login");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not claim delivery");
      return;
    }
    setNotice(`Order #${orderId} claimed`);
    await load();
  }

  const delivered = history.filter((h) => h.status === "DELIVERED");
  const avgMinutes =
    delivered.length > 0
      ? Math.round(
          delivered.reduce((sum, h) => {
            const start = h.accepted_at ?? h.assigned_at;
            const end = h.delivered_at;
            if (!start || !end) return sum;
            return sum + (new Date(end).getTime() - new Date(start).getTime()) / 60000;
          }, 0) / delivered.length
        )
      : null;

  if (loading) {
    return <main className="mx-auto max-w-6xl p-6">Loading delivery dashboard…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Delivery Dashboard</h1>
          <p className="text-sm text-stone-500">
            {partner
              ? `${partner.vehicle_type}${partner.vehicle_no ? ` · ${partner.vehicle_no}` : ""} · Rating ${Number(partner.rating).toFixed(1)}`
              : "No partner profile yet — claim an order to create one."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAvailability}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            partner?.is_available ?? true
              ? "bg-emerald-600 text-white"
              : "bg-stone-300 text-stone-700"
          }`}
        >
          <Bike size={16} />
          {partner?.is_available ?? true ? "Available — tap to go offline" : "Offline — tap to go available"}
        </button>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Active deliveries" value={String(assigned.length)} icon={<Bike size={20} />} />
        <StatCard title="Delivered (recent)" value={String(delivered.length)} icon={<PackageCheck size={20} />} />
        <StatCard
          title="Avg delivery time"
          value={avgMinutes === null ? "—" : `${avgMinutes} min`}
          sub="Accepted → delivered"
          icon={<Clock size={20} />}
        />
        <StatCard title="Available pickups" value={String(available.length)} icon={<MapPin size={20} />} />
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Assigned to you</h2>
          <DataTable<DeliveryRow>
            columns={[
              { key: "order", label: "Order", render: (r) => `#${r.order?.id}` },
              {
                key: "restaurant",
                label: "Restaurant",
                render: (r) => (
                  <span>
                    {r.order?.restaurant?.name}
                    <br />
                    <span className="text-xs text-stone-500">
                      {r.order?.restaurant?.address}, {r.order?.restaurant?.city}
                    </span>
                  </span>
                ),
              },
              {
                key: "customer",
                label: "Deliver to",
                render: (r) => (
                  <span>
                    {r.order?.user?.name} · {r.order?.user?.phone ?? ""}
                    <br />
                    <span className="text-xs text-stone-500">
                      {r.order?.address
                        ? `${r.order.address.line1}, ${r.order.address.city} ${r.order.address.pincode}`
                        : "No address on file"}
                    </span>
                  </span>
                ),
              },
              { key: "total", label: "Total", render: (r) => formatINR(r.order?.total_amount ?? 0) },
              { key: "status", label: "Status", render: (r) => <span className="font-semibold">{r.status}</span> },
              {
                key: "action",
                label: "Next step",
                render: (r) => {
                  const next = NEXT_ACTION[r.status];
                  if (!next) return <span className="text-stone-400">—</span>;
                  return (
                    <button
                      type="button"
                      onClick={() => advance(r.id, next.status)}
                      className="rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      {next.label}
                    </button>
                  );
                },
              },
            ]}
            data={assigned}
            emptyText="Nothing assigned right now — check available pickups below."
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Available for pickup</h2>
          <DataTable<AvailableRow>
            columns={[
              { key: "orderId", label: "Order", render: (r) => `#${r.orderId}` },
              { key: "restaurant", label: "Restaurant", render: (r) => r.order?.restaurant?.name },
              {
                key: "items",
                label: "Items",
                render: (r) => r.order?.items?.map((i) => `${i.qty}× ${i.item_name}`).join(", "),
              },
              { key: "total", label: "Total", render: (r) => formatINR(r.order?.total_amount ?? 0) },
              {
                key: "claim",
                label: "",
                render: (r) => (
                  <button
                    type="button"
                    onClick={() => claim(r.orderId)}
                    className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
                  >
                    Claim
                  </button>
                ),
              },
            ]}
            data={available}
            emptyText="No unassigned orders right now."
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">History</h2>
          <DataTable<DeliveryRow>
            columns={[
              { key: "order", label: "Order", render: (r) => `#${r.order?.id}` },
              { key: "restaurant", label: "Restaurant", render: (r) => r.order?.restaurant?.name },
              { key: "total", label: "Total", render: (r) => formatINR(r.order?.total_amount ?? 0) },
              { key: "status", label: "Status" },
              {
                key: "delivered_at",
                label: "Delivered",
                render: (r) =>
                  r.delivered_at ? new Date(r.delivered_at).toLocaleString() : "—",
              },
            ]}
            data={history}
            emptyText="No completed deliveries yet."
          />
        </section>
      </motion.div>
    </main>
  );
}
