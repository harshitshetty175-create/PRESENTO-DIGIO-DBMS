import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, serializeValue } from "../../_helpers";
import { validateReadOnlySQL } from "@/lib/sql-guard";

function sanitizeError(message: string): string {
  const url = process.env.DATABASE_URL;
  let out = message;
  if (url) out = out.split(url).join("[DATABASE_URL redacted]");
  // Strip any mysql:// credential-looking fragment just in case.
  return out.replace(/mysql:\/\/[^\s"']+/gi, "mysql://[redacted]");
}

/**
 * POST /api/lab/query { sql } — read-only SQL playground.
 * Validated by lib/sql-guard, executed via $queryRawUnsafe only after
 * validation, with a 5s timeout race. Max 100 rows. Errors are 400s and
 * never leak DATABASE_URL.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  let body: { sql?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  if (!sql) {
    return NextResponse.json({ error: "sql is required" }, { status: 400 });
  }

  // lib/sql-guard: either throws on invalid SQL or returns { ok, error }.
  // On success it returns the query REWRITTEN with LIMIT capped at 100 —
  // execute that rewritten SQL, not the raw input.
  let effectiveSql = sql;
  try {
    const validation = validateReadOnlySQL(sql) as
      | { ok: boolean; sql?: string; error?: string }
      | undefined;
    if (validation && typeof validation === "object" && "ok" in validation) {
      if (validation.ok === false) {
        return NextResponse.json(
          { error: validation.error ?? "Only read-only SELECT queries are allowed" },
          { status: 400 }
        );
      }
      if (typeof validation.sql === "string" && validation.sql.trim()) {
        effectiveSql = validation.sql;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err instanceof Error ? err.message : "Only read-only SELECT queries are allowed") },
      { status: 400 }
    );
  }

  const started = Date.now();
  try {
    const raw = await Promise.race([
      prisma.$queryRawUnsafe<unknown[]>(effectiveSql),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("Query timed out after 5 seconds")), 5000)
      ),
    ]);
    const executionMs = Date.now() - started;
    const allRows = Array.isArray(raw) ? raw : [];
    const rows = allRows.slice(0, 100).map((r) => serializeValue(r as Record<string, unknown>));
    const columns =
      allRows.length > 0 && typeof allRows[0] === "object" && allRows[0] !== null
        ? Object.keys(allRows[0] as Record<string, unknown>)
        : [];
    return NextResponse.json({
      columns,
      rows,
      rowCount: allRows.length,
      executionMs,
      truncated: allRows.length > 100,
    });
  } catch (err) {
    const executionMs = Date.now() - started;
    return NextResponse.json(
      {
        error: sanitizeError(
          err instanceof Error ? err.message : "Query failed"
        ),
        executionMs,
      },
      { status: 400 }
    );
  }
}
