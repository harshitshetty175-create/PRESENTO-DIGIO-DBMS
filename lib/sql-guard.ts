/**
 * Read-only SQL guard for the admin SQL Lab.
 * Only a single SELECT / WITH statement over allowlisted tables/views is
 * permitted, and every result is capped at 100 rows.
 */

export const ALLOWLISTED_TABLES = [
  "users",
  "addresses",
  "restaurants",
  "restaurant_admins",
  "categories",
  "food_items",
  "inventory",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "payments",
  "delivery_partners",
  "deliveries",
  "coupons",
  "coupon_usage",
  "reviews",
  "favourites",
  "notifications",
  "order_status_history",
  "audit_logs",
  "v_customer_order_history",
  "v_restaurant_sales",
  "v_popular_foods",
  "v_monthly_revenue",
] as const;

const MAX_ROWS = 100;

// Word-boundary keywords that are never allowed in a read-only query.
// UNION is deliberately allowed (read-only set combination).
const BLOCKED_WORD_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "CALL",
  "EXEC",
  "EXECUTE",
  "HANDLER",
  "LOAD_FILE",
  "SLEEP",
  "BENCHMARK",
  "INTO",
] as const;

// Substring patterns (multi-word / operators) that are never allowed.
const BLOCKED_SUBSTRINGS = [
  "into outfile",
  "into dumpfile",
  "--",
  "/*",
  "*/",
] as const;

export type SqlGuardResult = { ok: true; sql: string } | { ok: false; error: string };

export function validateReadOnlySQL(input: string): SqlGuardResult {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "SQL query is empty." };
  }

  let sql = input.trim();

  // Single statement only: at most one trailing semicolon.
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (sql.includes(";")) {
    return { ok: false, error: "Only a single SQL statement is allowed." };
  }

  // Must start with SELECT or WITH (CTE).
  if (!/^(SELECT|WITH)\b/i.test(sql)) {
    return { ok: false, error: "Only SELECT (or WITH ... SELECT) queries are allowed." };
  }

  const lower = sql.toLowerCase();

  for (const pattern of BLOCKED_SUBSTRINGS) {
    if (lower.includes(pattern)) {
      return { ok: false, error: `Blocked pattern in query: ${pattern}` };
    }
  }
  for (const keyword of BLOCKED_WORD_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(sql)) {
      return { ok: false, error: `Blocked keyword in query: ${keyword}` };
    }
  }

  // Every table referenced after FROM / JOIN must be allowlisted.
  // (Covers subqueries too, since the regex scans the whole statement.)
  const tableRegex = /(?:FROM|JOIN)\s+`?([A-Za-z0-9_]+)`?/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(sql)) !== null) {
    const table = (match[1] ?? "").toLowerCase();
    if (seen.has(table)) continue;
    seen.add(table);
    if (
      !(ALLOWLISTED_TABLES as readonly string[]).includes(table)
    ) {
      return { ok: false, error: `Table not allowed: ${table}` };
    }
  }

  // Enforce LIMIT: cap any LIMIT above 100, append LIMIT 100 when absent.
  const offsetComma = sql.match(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/i);
  if (offsetComma) {
    const offset = Number(offsetComma[1]);
    const count = Number(offsetComma[2]);
    if (count > MAX_ROWS) {
      sql = sql.replace(
        /\bLIMIT\s+\d+\s*,\s*\d+/i,
        `LIMIT ${offset}, ${MAX_ROWS}`,
      );
    }
  } else {
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const count = Number(limitMatch[1]);
      if (count > MAX_ROWS) {
        sql = sql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${MAX_ROWS}`);
      }
    } else {
      sql = `${sql} LIMIT ${MAX_ROWS}`;
    }
  }

  return { ok: true, sql };
}
