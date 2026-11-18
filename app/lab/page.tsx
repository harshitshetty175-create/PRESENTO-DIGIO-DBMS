"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Database,
  Table2,
  Play,
  ShieldCheck,
  Zap,
  GitBranch,
  FileBarChart,
  Network,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import ErDiagram from "@/components/ErDiagram";
import DataTable from "@/components/DataTable";
import AiAssistant from "@/components/AiAssistant";

type LabTable = {
  name: string;
  rows: number;
  columns: { name: string; type: string; nullable: boolean; key: string }[];
  primaryKey: string | null;
  foreignKeys: { column: string; references: string }[];
};

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
  truncated?: boolean;
};

type TxResult = {
  action: string;
  steps: { sql: string; result: string }[];
  before: number;
  intermediate?: number;
  after: number;
  restoredStock?: number;
};

type ConcResult = {
  initialStock: number;
  qty: number;
  results: { customer: string; success: boolean; rowsAffected: number }[];
  finalStock: number;
  preventedOversell: boolean;
  note: string;
};

const TABS = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "er", label: "ER Diagram", icon: Network },
  { id: "sql", label: "SQL Playground", icon: Play },
  { id: "explorer", label: "Table Explorer", icon: Table2 },
  { id: "normalization", label: "Normalization", icon: GitBranch },
  { id: "transactions", label: "Transactions", icon: FlaskConical },
  { id: "acid", label: "ACID", icon: ShieldCheck },
  { id: "concurrency", label: "Concurrency", icon: Zap },
  { id: "gallery", label: "Query Gallery", icon: FileBarChart },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "ai", label: "AI Assistant", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SAMPLE_QUERIES: { label: string; sql: string }[] = [
  { label: "All restaurants", sql: "SELECT id, name, cuisine, city, rating FROM restaurants ORDER BY rating DESC LIMIT 10" },
  { label: "Delivered orders + revenue", sql: "SELECT COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders WHERE status = 'DELIVERED'" },
  { label: "Top-selling foods", sql: "SELECT item_name, SUM(qty) AS qty_sold, SUM(line_total) AS revenue FROM order_items GROUP BY item_name ORDER BY qty_sold DESC LIMIT 10" },
  { label: "Orders per status", sql: "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC" },
  { label: "Low-stock items", sql: "SELECT f.name, i.stock_qty, i.low_stock_at FROM inventory i JOIN food_items f ON f.id = i.food_item_id WHERE i.stock_qty <= i.low_stock_at" },
];

const GALLERY: { title: string; category: string; sql: string; runnable: boolean; note?: string }[] = [
  { title: "All open restaurants in a city", category: "SELECT", runnable: true, sql: "SELECT id, name, cuisine, rating FROM restaurants WHERE is_open = 1 AND is_active = 1 ORDER BY rating DESC LIMIT 10" },
  { title: "Customer's order history with restaurant names", category: "JOIN", runnable: true, sql: "SELECT o.id, o.status, o.total_amount, r.name AS restaurant, o.placed_at FROM orders o JOIN restaurants r ON r.id = o.restaurant_id ORDER BY o.placed_at DESC LIMIT 10" },
  { title: "Revenue per restaurant", category: "GROUP BY", runnable: true, sql: "SELECT r.name AS restaurant, COUNT(o.id) AS orders, SUM(o.total_amount) AS revenue FROM orders o JOIN restaurants r ON r.id = o.restaurant_id GROUP BY r.name ORDER BY revenue DESC" },
  { title: "Restaurants with more than 5 orders", category: "HAVING", runnable: true, sql: "SELECT r.name AS restaurant, COUNT(o.id) AS orders FROM orders o JOIN restaurants r ON r.id = o.restaurant_id GROUP BY r.name HAVING COUNT(o.id) > 5 ORDER BY orders DESC" },
  { title: "Foods pricier than the average food", category: "Subquery", runnable: true, sql: "SELECT name, price FROM food_items WHERE price > (SELECT AVG(price) FROM food_items) ORDER BY price DESC LIMIT 10" },
  { title: "Best-selling item per order (window-style)", category: "Subquery", runnable: true, sql: "SELECT item_name, SUM(qty) AS qty_sold FROM order_items GROUP BY item_name ORDER BY qty_sold DESC LIMIT 5" },
  { title: "Delivered-orders view (CREATE VIEW)", category: "View", runnable: false, note: "Sandbox only — not executed. Views are DDL, and the playground is read-only.", sql: "CREATE VIEW delivered_orders AS\nSELECT o.id, o.user_id, o.restaurant_id, o.total_amount, o.placed_at\nFROM orders o\nWHERE o.status = 'DELIVERED';" },
  { title: "Insert a new coupon", category: "INSERT", runnable: false, note: "Sandbox only — not executed. The playground only runs read-only SELECTs.", sql: "INSERT INTO coupons (code, discount_percent, max_discount, min_order, is_active)\nVALUES ('LAB10', 10.00, 100.00, 299.00, 1);" },
  { title: "Restock an item", category: "UPDATE", runnable: false, note: "Sandbox only — not executed. Stock changes go through the restaurant dashboard instead.", sql: "UPDATE inventory SET stock_qty = stock_qty + 10 WHERE food_item_id = 1;" },
  { title: "Delete a cancelled order", category: "DELETE", runnable: false, note: "Sandbox only — not executed. Deletes are destructive and never run from the lab.", sql: "DELETE FROM orders WHERE status = 'CANCELLED' AND placed_at < '2025-01-01';" },
];

const REPORT_TYPES = [
  { value: "daily-orders", label: "Daily orders" },
  { value: "restaurant-sales", label: "Restaurant sales" },
  { value: "popular-foods", label: "Popular foods" },
  { value: "payment-summary", label: "Payment summary" },
  { value: "monthly-revenue", label: "Monthly revenue" },
];

export default function DbmsLabPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<{ database: string; source: string; tables: LabTable[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // SQL playground
  const [sql, setSql] = useState(SAMPLE_QUERIES[1].sql);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState("");
  const [queryRunning, setQueryRunning] = useState(false);

  // Table explorer
  const [selectedTable, setSelectedTable] = useState("orders");
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [tableColumns, setTableColumns] = useState<{ name: string; type: string }[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [tableTotalPages, setTableTotalPages] = useState(1);
  const [tableTotal, setTableTotal] = useState(0);
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Transactions / concurrency
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [txRunning, setTxRunning] = useState("");
  const [concResult, setConcResult] = useState<ConcResult | null>(null);
  const [concRunning, setConcRunning] = useState(false);

  // Reports
  const [reportType, setReportType] = useState("daily-orders");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);
  const [reportLoaded, setReportLoaded] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/lab/overview");
    if (res.status === 401) return router.push("/login");
    if (res.ok) setOverview(await res.json());
  }, [router]);

  useEffect(() => {
    loadOverview()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load lab overview"))
      .finally(() => setLoading(false));
  }, [loadOverview]);

  const loadTable = useCallback(async () => {
    const q = new URLSearchParams({
      page: String(tablePage),
      limit: "20",
      sort: sortKey,
      dir: sortDir,
    });
    const res = await fetch(`/api/lab/tables/${selectedTable}?${q}`);
    if (res.status === 401) return router.push("/login");
    if (res.ok) {
      const d = await res.json();
      setTableRows(d.rows ?? []);
      setTableColumns(d.columns ?? []);
      setTableTotalPages(d.totalPages ?? 1);
      setTableTotal(d.total ?? 0);
    }
  }, [router, selectedTable, tablePage, sortKey, sortDir]);

  useEffect(() => {
    if (tab === "explorer") loadTable();
  }, [tab, loadTable]);

  async function runQuery(sqlText: string) {
    setQueryRunning(true);
    setQueryError("");
    setQueryResult(null);
    const res = await fetch("/api/lab/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: sqlText }),
    });
    if (res.status === 401) return router.push("/login");
    const d = await res.json().catch(() => ({}));
    setQueryRunning(false);
    if (!res.ok) {
      setQueryError(d.error ?? "Query failed");
      return;
    }
    setQueryResult(d as QueryResult);
  }

  async function runTransaction(action: string) {
    setTxRunning(action);
    setError("");
    const res = await fetch("/api/lab/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.status === 401) return router.push("/login");
    const d = await res.json().catch(() => ({}));
    setTxRunning("");
    if (!res.ok) {
      setError(d.error ?? "Transaction demo failed");
      return;
    }
    setTxResult(d as TxResult);
  }

  async function runConcurrency() {
    setConcRunning(true);
    setError("");
    const res = await fetch("/api/lab/concurrency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: 1 }),
    });
    if (res.status === 401) return router.push("/login");
    const d = await res.json().catch(() => ({}));
    setConcRunning(false);
    if (!res.ok) {
      setError(d.error ?? "Concurrency demo failed");
      return;
    }
    setConcResult(d as ConcResult);
  }

  async function runReport() {
    const q = new URLSearchParams({ type: reportType });
    if (reportFrom) q.set("from", reportFrom);
    if (reportTo) q.set("to", reportTo);
    const res = await fetch(`/api/lab/reports?${q}`);
    if (res.status === 401) return router.push("/login");
    if (res.ok) {
      const d = await res.json();
      setReportRows(d.rows ?? []);
      setReportLoaded(true);
    }
  }

  function onSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setTablePage(1);
  }

  const reportColumns =
    reportRows.length > 0 ? Object.keys(reportRows[0]) : [];

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6">Loading DBMS Lab…</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">DBMS Lab — food_ordering_db</h1>
        <p className="text-sm text-stone-500">
          Explore the real database behind FoodFlow: schema, ER diagram, read-only SQL,
          transactions, ACID and concurrency — on live data, without touching real orders.
        </p>
        {overview ? (
          <p className="mt-1 text-xs text-stone-400">
            Metadata source: {overview.source} · {overview.tables.length} tables
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium ${
              tab === t.id ? "bg-brand-600 text-white" : "border border-stone-300 bg-white text-stone-700"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "overview" ? (
          <section>
            <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <p className="text-sm">
                <span className="font-semibold">Database:</span>{" "}
                <code className="rounded bg-stone-100 px-1.5 py-0.5">{overview?.database ?? "food_ordering_db"}</code>{" "}
                · MySQL 8 · {overview?.tables.reduce((s, t) => s + t.rows, 0) ?? 0} rows across{" "}
                {overview?.tables.length ?? 0} tables (live counts)
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(overview?.tables ?? []).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setSelectedTable(t.name);
                    setTablePage(1);
                    setTab("explorer");
                  }}
                  className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-card hover:border-brand-400"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm font-bold">{t.name}</h3>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                      {t.rows} rows
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    PK: {t.primaryKey ?? "—"}
                    {t.foreignKeys.length > 0
                      ? ` · FKs: ${t.foreignKeys.map((f) => `${f.column} → ${f.references}`).join(", ")}`
                      : " · no FKs"}
                  </p>
                  <p className="mt-2 line-clamp-3 font-mono text-[11px] leading-5 text-stone-600">
                    {t.columns.map((c) => c.name).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "er" ? (
          <section>
            <p className="mb-4 text-sm text-stone-600">
              Entity–relationship diagram for <code>food_ordering_db</code> (21 entities, derived from{" "}
              <code>prisma/schema.prisma</code>). Lines connect each foreign key to the primary key it references.
            </p>
            <ErDiagram />
          </section>
        ) : null}

        {tab === "sql" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Read-only playground: only <code>SELECT</code> / <code>WITH</code> queries run here.
              INSERT, UPDATE, DELETE, DROP and friends are rejected by the server-side guard before execution.
              Results are capped at 100 rows and each query has a 5-second timeout.
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSql(s.sql)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium hover:border-brand-400"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full rounded-2xl border border-stone-300 bg-white p-4 font-mono text-sm shadow-card"
              aria-label="SQL query"
            />
            <button
              type="button"
              onClick={() => runQuery(sql)}
              disabled={queryRunning}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Play size={16} /> {queryRunning ? "Running…" : "Run query"}
            </button>
            {queryError ? (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{queryError}</p>
            ) : null}
            {queryResult ? (
              <div>
                <p className="mb-2 text-sm text-stone-600">
                  {queryResult.rowCount} row{queryResult.rowCount === 1 ? "" : "s"}
                  {queryResult.truncated ? " (showing first 100)" : ""} · executed in{" "}
                  {queryResult.executionMs} ms
                </p>
                <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-card">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                        {queryResult.columns.map((c) => (
                          <th key={c} className="px-4 py-2 font-semibold">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.length === 0 ? (
                        <tr><td colSpan={queryResult.columns.length} className="px-4 py-6 text-center text-stone-500">Query returned no rows.</td></tr>
                      ) : (
                        queryResult.rows.map((row, i) => (
                          <tr key={i} className="border-b border-stone-100 last:border-0">
                            {queryResult.columns.map((c) => (
                              <td key={c} className="px-4 py-2 font-mono text-xs text-stone-700">
                                {row[c] === null || row[c] === undefined ? <span className="text-stone-400">NULL</span> : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "ai" ? (
          <AiAssistant />
        ) : null}

        {tab === "explorer" ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="lab-table" className="text-sm font-medium">Table</label>
              <select
                id="lab-table"
                value={selectedTable}
                onChange={(e) => { setSelectedTable(e.target.value); setTablePage(1); }}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm"
              >
                {(overview?.tables ?? []).map((t) => (
                  <option key={t.name} value={t.name}>{t.name} ({t.rows})</option>
                ))}
              </select>
              <span className="text-sm text-stone-500">{tableTotal} rows total</span>
            </div>
            <DataTable<Record<string, unknown>>
              columns={tableColumns.map((c) => ({ key: c.name, label: `${c.name} (${c.type})`, sortable: true }))}
              data={tableRows}
              page={tablePage}
              totalPages={tableTotalPages}
              onPageChange={setTablePage}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              emptyText="This table has no rows yet."
            />
          </section>
        ) : null}

        {tab === "normalization" ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Educational demo — the examples below illustrate the normal forms using FoodFlow&apos;s
              orders data shape. They describe the design; they are not a migration.
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-card">
                <h2 className="mb-2 font-semibold text-red-700">Before — one flat table (unnormalized)</h2>
                <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-5 text-stone-100">{`order_id | customer_name | customer_phone | restaurant_name | item_name | qty | unit_price
       101 | Aarav Sharma  | 98110 00000     | Spice Route     | Paneer Tikka|  2  | 249.00
       101 | Aarav Sharma  | 98110 00000     | Spice Route     | Butter Naan |  4  |  49.00
       102 | Aarav Sharma  | 98110 00000     | Spice Route     | Paneer Tikka|  1  | 249.00`}</pre>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
                  <li>Customer name/phone and restaurant name repeat on every item row.</li>
                  <li>Changing a phone number means updating many rows — or they drift apart (update anomaly).</li>
                  <li>A restaurant with no orders yet cannot be stored at all (insertion anomaly).</li>
                  <li>Deleting the last order for an item deletes the only copy of its price (deletion anomaly).</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-card">
                <h2 className="mb-2 font-semibold text-emerald-700">After — normalized (FoodFlow&apos;s real schema)</h2>
                <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-5 text-stone-100">{`users(id, name, phone, email, …)
restaurants(id, owner_id → users.id, name, …)
orders(id, user_id → users.id, restaurant_id → restaurants.id,
       status, total_amount, placed_at)
order_items(id, order_id → orders.id, food_item_id → food_items.id,
            item_name, unit_price, qty, line_total)`}</pre>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
                  <li>Each fact lives once: a phone number lives in <code>users</code>, a price snapshot in <code>order_items</code>.</li>
                  <li>Joins rebuild the flat view whenever it is needed — see the Query Gallery.</li>
                </ul>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                <h3 className="font-semibold">1NF — atomic values, no repeating groups</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Every column holds one value per row. Instead of an <code>items</code> column holding
                  &ldquo;Paneer Tikka ×2, Butter Naan ×4&rdquo;, each item gets its own row in{" "}
                  <code>order_items</code> with its own <code>qty</code>.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                <h3 className="font-semibold">2NF — no partial dependencies</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Every non-key column depends on the whole key. In <code>order_items</code> the key is{" "}
                  <code>id</code>, so <code>item_name</code> and <code>unit_price</code> describe that line —
                  the customer&apos;s name does not belong here; it lives in <code>users</code> via{" "}
                  <code>orders.user_id</code>.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                <h3 className="font-semibold">3NF — no transitive dependencies</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Non-key columns depend only on the key. A restaurant&apos;s <code>city</code> depends on the
                  restaurant, not on the order — so it lives in <code>restaurants</code>, not in{" "}
                  <code>orders</code>. (FoodFlow deliberately keeps <code>item_name</code> /{" "}
                  <code>unit_price</code> snapshots in <code>order_items</code> so history stays correct
                  after a menu price changes — a conscious, documented denormalization.)
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "transactions" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <p className="text-sm text-stone-600">
                These demos run only on the demo inventory row for{" "}
                <code className="rounded bg-stone-100 px-1">DBMS Lab Demo Item</code> in the dedicated
                demo restaurant — never on real stock or orders. The demo item is created on demand if missing.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runTransaction("demo-rollback")}
                  disabled={!!txRunning}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {txRunning === "demo-rollback" ? "Running…" : "Demo: rollback"}
                </button>
                <button
                  type="button"
                  onClick={() => runTransaction("demo-commit")}
                  disabled={!!txRunning}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {txRunning === "demo-commit" ? "Running…" : "Demo: commit"}
                </button>
                <button
                  type="button"
                  onClick={() => runTransaction("demo-savepoint")}
                  disabled={!!txRunning}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {txRunning === "demo-savepoint" ? "Running…" : "Demo: savepoint"}
                </button>
              </div>
            </div>
            {txResult ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                <p className="mb-3 text-sm">
                  <span className="font-semibold">{txResult.action}</span> · stock before:{" "}
                  <strong>{txResult.before}</strong>
                  {txResult.intermediate !== undefined ? (
                    <> · intermediate (inside transaction): <strong>{txResult.intermediate}</strong></>
                  ) : null}{" "}
                  · after: <strong>{txResult.after}</strong>
                  {txResult.restoredStock !== undefined ? (
                    <> · restored to: <strong>{txResult.restoredStock}</strong> (cleanup)</>
                  ) : null}
                </p>
                <ol className="space-y-2">
                  {txResult.steps.map((s, i) => (
                    <li key={i} className="rounded-lg bg-stone-50 p-3 text-sm">
                      <code className="font-mono text-xs">{s.sql}</code>
                      <p className="mt-1 text-stone-600">{s.result}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Run a demo to see each SQL step and the stock before / after.</p>
            )}
          </section>
        ) : null}

        {tab === "acid" ? (
          <section className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Atomicity",
                body: "A transaction is all-or-nothing. The rollback demo decrements demo stock and then rolls back: the stock is exactly what it was before — no half-applied update survives.",
                evidence: "Transactions tab → Demo: rollback (before == after).",
              },
              {
                title: "Consistency",
                body: "The database moves only between valid states. Foreign keys (orders.user_id → users.id, order_items.order_id → orders.id) and the one-restaurant-per-cart rule keep references valid, and stock can never go negative through the guarded conditional update.",
                evidence: "Concurrency tab → preventedOversell is true; ER Diagram shows every FK.",
              },
              {
                title: "Isolation",
                body: "Two customers racing for the last item each run a conditional UPDATE … WHERE stock_qty >= ?. The database serializes the writes, so only one update matches a row — the other sees stock 0 and fails instead of overselling.",
                evidence: "Concurrency tab → exactly one of Customer A / B succeeds.",
              },
              {
                title: "Durability",
                body: "Once a transaction commits, it survives crashes — MySQL writes it to the redo log. The commit demo shows a committed decrement that persists until the lab explicitly restores it as cleanup.",
                evidence: "Transactions tab → Demo: commit (after = before − 1, committed).",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck size={18} className="text-brand-600" /> {c.title}
                </h3>
                <p className="mt-2 text-sm text-stone-600">{c.body}</p>
                <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-stone-600">
                  <span className="font-semibold">Demo evidence: </span>
                  {c.evidence}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {tab === "concurrency" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
              <p className="text-sm text-stone-600">
                Two customers order the last unit of an item at the same instant. The simulation runs on a
                temporary cloned demo inventory row (stock = 1) that is deleted afterwards — no real orders
                or stock change. Both customers fire the same guarded update in parallel:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-xs leading-5 text-stone-100">{`UPDATE inventory
SET stock_qty = stock_qty - 1
WHERE food_item_id = ? AND stock_qty >= 1;`}</pre>
              <button
                type="button"
                onClick={runConcurrency}
                disabled={concRunning}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Zap size={16} /> {concRunning ? "Racing…" : "Run the two-customer race"}
              </button>
            </div>
            {concResult ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                <p className="text-sm text-stone-600">{concResult.note}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <p className="text-xs uppercase text-stone-500">Initial stock</p>
                    <p className="text-xl font-bold">{concResult.initialStock}</p>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <p className="text-xs uppercase text-stone-500">Final stock</p>
                    <p className="text-xl font-bold">{concResult.finalStock}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${concResult.preventedOversell ? "bg-emerald-50" : "bg-red-50"}`}>
                    <p className="text-xs uppercase text-stone-500">Oversell prevented?</p>
                    <p className={`text-xl font-bold ${concResult.preventedOversell ? "text-emerald-700" : "text-red-700"}`}>
                      {concResult.preventedOversell ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {concResult.results.map((r) => (
                    <li key={r.customer} className="flex justify-between border-b border-stone-100 py-2 last:border-0">
                      <span>{r.customer}</span>
                      <span className={r.success ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                        {r.success ? "Order succeeded (1 row updated)" : "Order failed — out of stock (0 rows updated)"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "gallery" ? (
          <section className="space-y-4">
            <p className="text-sm text-stone-600">
              Curated examples. <strong>Run</strong> executes the read-only ones in the playground and shows
              the result below; INSERT / UPDATE / DELETE / view examples are shown as code only and are never executed.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {GALLERY.map((g) => (
                <div key={g.title} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{g.title}</h3>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">{g.category}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] leading-5 text-stone-100">{g.sql}</pre>
                  {g.runnable ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSql(g.sql);
                        setNotice(`Loaded “${g.title}” — running it now.`);
                        runQuery(g.sql);
                      }}
                      disabled={queryRunning}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      <Play size={13} /> Run
                    </button>
                  ) : (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Sandbox only — not executed. {g.note ?? ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {queryError ? (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{queryError}</p>
            ) : null}
            {queryResult ? (
              <div>
                <p className="mb-2 text-sm text-stone-600">
                  {queryResult.rowCount} row{queryResult.rowCount === 1 ? "" : "s"} · {queryResult.executionMs} ms
                </p>
                <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-card">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                        {queryResult.columns.map((c) => (
                          <th key={c} className="px-4 py-2 font-semibold">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-stone-100 last:border-0">
                          {queryResult.columns.map((c) => (
                            <td key={c} className="px-4 py-2 font-mono text-xs text-stone-700">
                              {row[c] === null || row[c] === undefined ? <span className="text-stone-400">NULL</span> : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "reports" ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Report</span>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
                  {REPORT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">From</span>
                <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">To</span>
                <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <button type="button" onClick={runReport} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
                Generate report
              </button>
            </div>
            {reportLoaded ? (
              reportRows.length === 0 ? (
                <p className="text-sm text-stone-500">No rows for this report / date range.</p>
              ) : (
                <DataTable<Record<string, unknown>>
                  columns={reportColumns.map((c) => ({ key: c, label: c }))}
                  data={reportRows}
                  emptyText="No rows for this report."
                />
              )
            ) : (
              <p className="text-sm text-stone-500">Pick a report type and date range, then generate it. Aggregations run live against the database.</p>
            )}
          </section>
        ) : null}
      </motion.div>
    </main>
  );
}
