import type { ReactNode } from "react";

export default function StatCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {title}
        </p>
        {icon ? <span className="text-brand-600">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-stone-500">{sub}</p> : null}
    </div>
  );
}
