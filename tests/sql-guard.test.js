/**
 * sql-guard.test.js — RULE-MIRROR unit tests.
 *
 * These tests do NOT import lib/sql-guard.ts (that file is TypeScript and
 * this suite runs under plain `node --test`). Instead they contain a
 * self-contained copy of the guard's rules, transcribed from
 * lib/sql-guard.ts, and assert the behaviour the real guard must have.
 * If the real guard changes, update this mirror to match.
 *
 * Rules mirrored (lib/sql-guard.ts):
 *  - Only a single SELECT / WITH statement; one trailing ";" is stripped,
 *    any other ";" rejects the query.
 *  - Blocked word-boundary keywords: INSERT UPDATE DELETE DROP ALTER
 *    CREATE TRUNCATE GRANT REVOKE CALL EXEC EXECUTE HANDLER LOAD_FILE
 *    SLEEP BENCHMARK INTO. (UNION is deliberately allowed.)
 *  - Blocked substrings: "into outfile", "into dumpfile", "--", "/*", "*\/".
 *  - Every table after FROM / JOIN must be in the allowlist (21 tables +
 *    4 views: v_customer_order_history, v_restaurant_sales,
 *    v_popular_foods, v_monthly_revenue).
 *  - LIMIT is capped at 100 (including LIMIT offset,count form);
 *    LIMIT 100 is appended when absent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// --- Begin mirror of lib/sql-guard.ts (transcribed, not imported) --------
const ALLOWLISTED_TABLES = [
  "users", "addresses", "restaurants", "restaurant_admins", "categories",
  "food_items", "inventory", "carts", "cart_items", "orders", "order_items",
  "payments", "delivery_partners", "deliveries", "coupons", "coupon_usage",
  "reviews", "favourites", "notifications", "order_status_history",
  "audit_logs", "v_customer_order_history", "v_restaurant_sales",
  "v_popular_foods", "v_monthly_revenue",
];
const MAX_ROWS = 100;
const BLOCKED_WORD_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE",
  "GRANT", "REVOKE", "CALL", "EXEC", "EXECUTE", "HANDLER", "LOAD_FILE",
  "SLEEP", "BENCHMARK", "INTO",
];
const BLOCKED_SUBSTRINGS = ["into outfile", "into dumpfile", "--", "/*", "*/"];

function validateReadOnlySQL(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "SQL query is empty." };
  }
  let sql = input.trim();
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (sql.includes(";")) {
    return { ok: false, error: "Only a single SQL statement is allowed." };
  }
  if (!/^(SELECT|WITH)\b/i.test(sql)) {
    return { ok: false, error: "Only SELECT (or WITH ... SELECT) queries are allowed." };
  }
  const lower = sql.toLowerCase();
  for (const pattern of BLOCKED_SUBSTRINGS) {
    if (lower.includes(pattern)) return { ok: false, error: `Blocked pattern in query: ${pattern}` };
  }
  for (const keyword of BLOCKED_WORD_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(sql)) {
      return { ok: false, error: `Blocked keyword in query: ${keyword}` };
    }
  }
  const tableRegex = /(?:FROM|JOIN)\s+`?([A-Za-z0-9_]+)`?/gi;
  const seen = new Set();
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const table = (match[1] ?? "").toLowerCase();
    if (seen.has(table)) continue;
    seen.add(table);
    if (!ALLOWLISTED_TABLES.includes(table)) {
      return { ok: false, error: `Table not allowed: ${table}` };
    }
  }
  const offsetComma = sql.match(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/i);
  if (offsetComma) {
    const offset = Number(offsetComma[1]);
    const count = Number(offsetComma[2]);
    if (count > MAX_ROWS) {
      sql = sql.replace(/\bLIMIT\s+\d+\s*,\s*\d+/i, `LIMIT ${offset}, ${MAX_ROWS}`);
    }
  } else {
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const count = Number(limitMatch[1]);
      if (count > MAX_ROWS) sql = sql.replace(/\bLIMIT\s+\d+/i, `LIMIT ${MAX_ROWS}`);
    } else {
      sql = `${sql} LIMIT ${MAX_ROWS}`;
    }
  }
  return { ok: true, sql };
}
// --- End mirror -----------------------------------------------------------

describe("sql-guard (rule mirror of lib/sql-guard.ts)", () => {
  it("allows a plain SELECT", () => {
    const r = validateReadOnlySQL("SELECT id, name FROM restaurants");
    assert.equal(r.ok, true);
    assert.equal(r.sql, "SELECT id, name FROM restaurants LIMIT 100");
  });

  it("allows WHERE, GROUP BY, JOIN and LIMIT", () => {
    const r = validateReadOnlySQL(
      "SELECT r.name, COUNT(o.id) AS n FROM restaurants r JOIN orders o ON o.restaurant_id = r.id WHERE o.status = 'DELIVERED' GROUP BY r.name LIMIT 10",
    );
    assert.equal(r.ok, true);
    assert.match(r.sql, /LIMIT 10$/);
  });

  it("allows WITH (CTE) queries whose FROMs reference allowlisted tables", () => {
    const r = validateReadOnlySQL(
      "WITH t AS (SELECT COUNT(*) AS c FROM orders) SELECT * FROM orders",
    );
    assert.equal(r.ok, true);
  });

  it("rejects SELECTing FROM a CTE name (not an allowlisted table)", () => {
    // Known limitation of the real guard: the table allowlist scan also
    // matches FROM <cte-name>, so a CTE must be consumed via a subquery
    // over a real table, not SELECTed from directly.
    const r = validateReadOnlySQL(
      "WITH top AS (SELECT restaurant_id, COUNT(*) c FROM orders GROUP BY restaurant_id) SELECT * FROM top",
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /Table not allowed: top/);
  });

  it("allows UNION (read-only set combination)", () => {
    const r = validateReadOnlySQL(
      "SELECT name FROM restaurants UNION SELECT name FROM categories",
    );
    assert.equal(r.ok, true);
  });

  it("allows queries over the reporting views", () => {
    const r = validateReadOnlySQL("SELECT * FROM v_restaurant_sales ORDER BY revenue DESC");
    assert.equal(r.ok, true);
  });

  it("caps LIMIT 500 down to 100", () => {
    const r = validateReadOnlySQL("SELECT * FROM orders LIMIT 500");
    assert.equal(r.ok, true);
    assert.equal(r.sql, "SELECT * FROM orders LIMIT 100");
  });

  it("caps the count in LIMIT offset,count form", () => {
    const r = validateReadOnlySQL("SELECT * FROM orders LIMIT 20, 500");
    assert.equal(r.ok, true);
    assert.equal(r.sql, "SELECT * FROM orders LIMIT 20, 100");
  });

  it("keeps a LIMIT under the cap unchanged", () => {
    const r = validateReadOnlySQL("SELECT * FROM orders LIMIT 5");
    assert.equal(r.ok, true);
    assert.equal(r.sql, "SELECT * FROM orders LIMIT 5");
  });

  it("accepts a single trailing semicolon", () => {
    const r = validateReadOnlySQL("SELECT * FROM users;");
    assert.equal(r.ok, true);
    assert.equal(r.sql, "SELECT * FROM users LIMIT 100");
  });

  it("blocks INSERT", () => {
    assert.equal(validateReadOnlySQL("INSERT INTO users (name) VALUES ('x')").ok, false);
  });

  it("blocks UPDATE and DELETE", () => {
    assert.equal(validateReadOnlySQL("UPDATE orders SET status='CANCELLED'").ok, false);
    assert.equal(validateReadOnlySQL("DELETE FROM carts").ok, false);
  });

  it("blocks DROP / TRUNCATE / ALTER", () => {
    assert.equal(validateReadOnlySQL("DROP TABLE orders").ok, false);
    assert.equal(validateReadOnlySQL("TRUNCATE TABLE orders").ok, false);
    assert.equal(validateReadOnlySQL("ALTER TABLE users ADD COLUMN x INT").ok, false);
  });

  it("blocks multiple statements / ';' injection", () => {
    assert.equal(validateReadOnlySQL("SELECT * FROM users; DROP TABLE users").ok, false);
    assert.equal(validateReadOnlySQL("SELECT * FROM users; SELECT * FROM orders").ok, false);
  });

  it("blocks an unknown table", () => {
    const r = validateReadOnlySQL("SELECT * FROM secret_admin_notes");
    assert.equal(r.ok, false);
    assert.match(r.error, /Table not allowed/);
  });

  it("blocks comment-based injection", () => {
    assert.equal(validateReadOnlySQL("SELECT * FROM users -- comment").ok, false);
    assert.equal(validateReadOnlySQL("SELECT * FROM users /* comment */").ok, false);
  });

  it("blocks SELECT ... INTO OUTFILE", () => {
    assert.equal(validateReadOnlySQL("SELECT * INTO OUTFILE '/tmp/x' FROM users").ok, false);
  });

  it("blocks CALL and SLEEP", () => {
    assert.equal(validateReadOnlySQL("CALL sp_customer_order_history(1)").ok, false);
    assert.equal(validateReadOnlySQL("SELECT SLEEP(5)").ok, false);
  });

  it("rejects an empty query and a non-SELECT statement", () => {
    assert.equal(validateReadOnlySQL("   ").ok, false);
    assert.equal(validateReadOnlySQL("SHOW TABLES").ok, false);
  });
});
