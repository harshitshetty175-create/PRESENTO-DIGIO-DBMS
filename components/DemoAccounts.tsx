"use client";

const DEMO_ACCOUNTS = [
  { label: "Customer", email: "customer@foodflow.in" },
  { label: "Restaurant", email: "restaurant@foodflow.in" },
  { label: "Delivery", email: "delivery@foodflow.in" },
  { label: "Admin", email: "admin@foodflow.in" },
] as const;

export default function DemoAccounts({
  onFill,
}: {
  onFill: (email: string, password: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        Demo accounts (local dev only)
      </p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Password for all demo accounts: <code className="rounded bg-stone-200 px-1 py-0.5 font-mono dark:bg-stone-700">Demo@1234</code>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onFill(account.email, "Demo@1234")}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-300 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
          >
            {account.label}
          </button>
        ))}
      </div>
    </div>
  );
}
