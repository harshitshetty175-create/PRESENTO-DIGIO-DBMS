"use client";

import { useState } from "react";
import { Sparkles, Send, AlertTriangle } from "lucide-react";

type AiResult = {
  available: boolean;
  source: "gemini" | "local";
  sql: string | null;
  explanation: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount?: number;
  executionMs?: number;
  message?: string;
};

const EXAMPLES = [
  "How many orders are there by status?",
  "What are the most popular foods?",
  "Show me monthly revenue",
  "Which items are low on stock?",
  "Summarise payments by method",
];

export default function AiAssistant() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const query = q.trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = (await res.json()) as AiResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The assistant could not answer that.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand-100 p-2 text-brand-600 dark:bg-brand-900/40">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">FOODFLOW INTELLIGENCE</h3>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Ask a question about the database in plain English. It is turned
              into a single read-only SELECT query, validated on the server,
              and run against the live database. Destructive SQL is never
              generated or executed.
            </p>
            {result && (
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                Mode:{" "}
                {result.source === "gemini"
                  ? "Gemini (GEMINI_API_KEY configured)"
                  : "Local fallback — set GEMINI_API_KEY in .env to enable Gemini"}
              </p>
            )}
          </div>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the most popular foods?"
            className="input flex-1"
            aria-label="Ask the AI assistant"
          />
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            <Send className="h-4 w-4" />
            {loading ? "Thinking…" : "Ask"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void ask(ex)}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-brand-500 hover:text-brand-600 dark:border-stone-700 dark:text-stone-300"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.message && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {result.message}
            </div>
          )}
          {result.sql && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card dark:border-stone-800 dark:bg-stone-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Generated SQL</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 p-3 text-sm text-stone-100">{result.sql}</pre>
              {result.explanation && (
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{result.explanation}</p>
              )}
              {typeof result.executionMs === "number" && (
                <p className="mt-1 text-xs text-stone-500">
                  {result.rowCount} row(s) in {result.executionMs} ms
                </p>
              )}
            </div>
          )}
          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-card dark:border-stone-800 dark:bg-stone-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800">
                    {result.columns.map((c) => (
                      <th key={c} className="px-4 py-2 text-left font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-stone-100 dark:border-stone-800/60">
                      {result.columns.map((c) => (
                        <td key={c} className="px-4 py-2">{String(row[c] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
