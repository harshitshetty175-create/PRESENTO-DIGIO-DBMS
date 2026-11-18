"use client";

import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

/**
 * Shared table for the dashboards: sortable headers, optional pagination.
 * Sorting is parent-controlled via onSort (server-side sort) — the header
 * only shows the indicator and fires the callback.
 */
export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  emptyText = "No rows yet.",
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-semibold">
                {c.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-brand-700"
                  >
                    {c.label}
                    <span className="text-brand-600">
                      {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-stone-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={(row.id as string | number | undefined) ?? i}
                className="border-b border-stone-100 last:border-0 hover:bg-cream"
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 align-top text-stone-700">
                    {c.render ? c.render(row) : String(row[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {page !== undefined && totalPages !== undefined && onPageChange ? (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-stone-600">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-stone-300 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-stone-300 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
