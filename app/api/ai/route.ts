import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { validateReadOnlySQL } from "@/lib/sql-guard";
import { audit } from "@/lib/notify";

/**
 * FOODFLOW INTELLIGENCE — optional AI assistant (POST /api/ai).
 *
 * - The Gemini API key lives ONLY on the server (GEMINI_API_KEY env).
 * - If the key is missing, the endpoint still works with a deterministic
 *   local intent matcher over pre-validated read-only queries.
 * - Any SQL — Gemini-generated or local — is validated by lib/sql-guard
 *   (single SELECT/WITH, allowlisted tables, LIMIT capped at 100) before
 *   execution, and the query runs with a timeout. No credentials or
 *   secrets are ever sent to the AI provider.
 */

const SCHEMA_SUMMARY = `
Tables: users(id,name,email,role), restaurants(id,name,cuisine,city,rating,delivery_fee,is_open),
food_items(id,restaurant_id,category_id,name,price,veg_type,is_available,rating),
categories(id,name), orders(id,user_id,restaurant_id,status,subtotal,delivery_fee,tax_amount,
discount_amount,total_amount,coupon_code,placed_at), order_items(id,order_id,item_name,unit_price,qty,line_total),
payments(id,order_id,amount,method,status), deliveries(id,order_id,partner_id,status,assigned_at,delivered_at),
delivery_partners(id,user_id,vehicle_type,is_available,rating), inventory(id,food_item_id,stock_qty,low_stock_at),
reviews(id,user_id,restaurant_id,food_item_id,rating,comment), coupons(id,code,discount_percent,max_discount,min_order,is_active),
favourites, notifications, order_status_history, audit_logs.
Views: v_customer_order_history, v_restaurant_sales, v_popular_foods, v_monthly_revenue.
Order statuses: PLACED, CONFIRMED, PREPARING, READY_FOR_PICKUP, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REJECTED.
`;

const LOCAL_INTENTS: { pattern: RegExp; sql: string; explanation: string }[] = [
  {
    pattern: /how many orders|total orders|orders.*(count|many)|order count/i,
    sql: "SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC",
    explanation: "Counts orders grouped by their current status.",
  },
  {
    pattern: /top|popular|best.?sell|most ordered|favourite food/i,
    sql: "SELECT item_name, SUM(qty) AS qty_sold, SUM(line_total) AS revenue FROM order_items GROUP BY item_name ORDER BY qty_sold DESC LIMIT 10",
    explanation: "Ranks food items by total quantity sold, with revenue.",
  },
  {
    pattern: /revenue|sales|money|earn/i,
    sql: "SELECT month, orders_count, revenue FROM v_monthly_revenue ORDER BY month DESC LIMIT 12",
    explanation: "Monthly revenue and order counts from the v_monthly_revenue view.",
  },
  {
    pattern: /restaurant/i,
    sql: "SELECT id, name, cuisine, city, rating FROM restaurants WHERE is_active = 1 ORDER BY rating DESC LIMIT 10",
    explanation: "Lists active restaurants ordered by rating.",
  },
  {
    pattern: /low.?stock|stock|inventory/i,
    sql: "SELECT f.name, i.stock_qty, i.low_stock_at FROM inventory i JOIN food_items f ON f.id = i.food_item_id WHERE i.stock_qty <= i.low_stock_at ORDER BY i.stock_qty ASC LIMIT 10",
    explanation: "Shows food items at or below their low-stock threshold.",
  },
  {
    pattern: /payment/i,
    sql: "SELECT method, status, COUNT(*) AS payments, SUM(amount) AS total FROM payments GROUP BY method, status ORDER BY total DESC",
    explanation: "Payment summary grouped by method and status.",
  },
  {
    pattern: /deliver/i,
    sql: "SELECT status, COUNT(*) AS deliveries FROM deliveries GROUP BY status ORDER BY deliveries DESC",
    explanation: "Delivery counts grouped by delivery status.",
  },
];

function localIntent(question: string) {
  return LOCAL_INTENTS.find((i) => i.pattern.test(question)) ?? null;
}

async function runReadOnly(sql: string) {
  const checked = validateReadOnlySQL(sql);
  if (!checked.ok) return { ok: false as const, error: checked.error };
  const started = Date.now();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Query timed out after 5s")), 5000),
  );
  try {
    const rows = (await Promise.race([
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(checked.sql),
      timeout,
    ])) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      ok: true as const,
      sql: checked.sql,
      columns,
      rows: rows.slice(0, 100),
      rowCount: rows.length,
      executionMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Query failed",
    };
  }
}

async function askGemini(question: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a SQL assistant for a food-ordering MySQL database. Convert the user's question into exactly ONE read-only MySQL SELECT query (or WITH ... SELECT). Use only the tables/views in this schema. Never use INSERT, UPDATE, DELETE, DROP, or any destructive statement. Always include a LIMIT of at most 100. Reply with ONLY the SQL query inside a \`\`\`sql code block, nothing else.\n\nSchema:\n${SCHEMA_SUMMARY}\n\nQuestion: ${question}`,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const match = text.match(/```sql\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
    const sql = (match ? match[1] : text).trim().replace(/;+\s*$/, "");
    return sql || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const body = (await parseBody(req)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) {
    return err("Please ask a question (max 500 characters)", 400);
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  let sql: string | null = null;
  let source: "gemini" | "local" = "local";
  let explanation = "";

  if (geminiConfigured) {
    sql = await askGemini(question);
    if (sql) {
      source = "gemini";
      explanation = "Generated by Gemini from your question, then validated as a read-only query.";
    }
  }
  if (!sql) {
    const intent = localIntent(question);
    if (!intent) {
      return json({
        available: geminiConfigured,
        source,
        question,
        sql: null,
        explanation: null,
        rows: [],
        columns: [],
        message: geminiConfigured
          ? "I couldn't turn that question into a safe read-only query. Try asking about orders, revenue, popular foods, restaurants, stock, payments or deliveries."
          : "AI is running in local mode (no GEMINI_API_KEY set). I can answer questions about orders, revenue, popular foods, restaurants, stock, payments or deliveries — try one of those.",
      });
    }
    sql = intent.sql;
    explanation = intent.explanation;
  }

  const result = await runReadOnly(sql);
  if (!result.ok) {
    return json({
      available: geminiConfigured,
      source,
      question,
      sql,
      explanation,
      rows: [],
      columns: [],
      message: `That query was rejected for safety: ${result.error}`,
    });
  }
  await audit(session.id, "AI_QUERY", "ai", null, question.slice(0, 200));
  return json({
    available: geminiConfigured,
    source,
    question,
    sql: result.sql,
    explanation,
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rowCount,
    executionMs: result.executionMs,
  });
}
