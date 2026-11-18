import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "../../_helpers";
import {
  DEMO_FOOD_NAME,
  ensureDemoFood,
  ensureDemoInventory,
  readStock,
} from "../_demo";

type Step = { sql: string; result: string };
type Action = "demo-rollback" | "demo-commit" | "demo-savepoint";

/**
 * POST /api/lab/transaction { action }
 * Operates ONLY on the demo inventory row for "DBMS Lab Demo Item"
 * (created on demand in the dedicated demo restaurant/category).
 * - demo-rollback: decrement inside a transaction, then roll back → unchanged.
 * - demo-commit: decrement and commit, then restore stock (cleanup) so the
 *   demo stays repeatable; the committed value is reported as `after`.
 * - demo-savepoint: decrement, SAVEPOINT, decrement again, ROLLBACK TO
 *   SAVEPOINT, commit → net effect of one decrement, then restore.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = String(body.action ?? "") as Action;
  if (!["demo-rollback", "demo-commit", "demo-savepoint"].includes(action)) {
    return NextResponse.json(
      {
        error:
          "Unknown action. Use demo-rollback, demo-commit or demo-savepoint.",
      },
      { status: 400 }
    );
  }

  let food;
  try {
    food = await ensureDemoFood(DEMO_FOOD_NAME);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo setup failed" },
      { status: 400 }
    );
  }
  await ensureDemoInventory(food.id, 10);
  const before = await readStock(food.id);
  const steps: Step[] = [];
  let after = before;
  let intermediate: number | undefined;

  try {
    if (action === "demo-rollback") {
      steps.push({ sql: "BEGIN", result: "transaction started" });
      steps.push({
        sql: `UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`,
        result: "1 row updated (inside transaction, not yet committed)",
      });
      try {
        await prisma.$transaction(async (tx) => {
          await tx.inventory.update({
            where: { food_item_id: food.id },
            data: { stock_qty: { decrement: 1 } },
          });
          throw new Error("DEMO_ROLLBACK");
        });
      } catch (err) {
        if (!(err instanceof Error) || err.message !== "DEMO_ROLLBACK") throw err;
      }
      steps.push({ sql: "ROLLBACK", result: "transaction rolled back on purpose" });
      after = await readStock(food.id);
      steps.push({
        sql: `SELECT stock_qty FROM inventory WHERE food_item_id = ${food.id}`,
        result: `stock_qty = ${after} (unchanged — atomicity held)`,
      });
    } else if (action === "demo-commit") {
      steps.push({ sql: "BEGIN", result: "transaction started" });
      await prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { food_item_id: food.id },
          data: { stock_qty: { decrement: 1 } },
        });
      });
      steps.push({
        sql: `UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`,
        result: "1 row updated",
      });
      steps.push({ sql: "COMMIT", result: "transaction committed" });
      after = await readStock(food.id);
      steps.push({
        sql: `SELECT stock_qty FROM inventory WHERE food_item_id = ${food.id}`,
        result: `stock_qty = ${after} (committed: ${before} → ${after})`,
      });
      // Restore so the demo is repeatable; the committed value stays reported as `after`.
      await prisma.inventory.update({
        where: { food_item_id: food.id },
        data: { stock_qty: { increment: 1 } },
      });
      steps.push({
        sql: `UPDATE inventory SET stock_qty = stock_qty + 1 WHERE food_item_id = ${food.id}`,
        result: "demo stock restored to its pre-demo value (cleanup, not part of the demo)",
      });
    } else {
      // demo-savepoint
      steps.push({ sql: "BEGIN", result: "transaction started" });
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`;
        steps.push({
          sql: `UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`,
          result: "1st decrement applied inside transaction",
        });
        await tx.$executeRaw`SAVEPOINT sp_lab`;
        steps.push({ sql: "SAVEPOINT sp_lab", result: "savepoint created" });
        await tx.$executeRaw`UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`;
        const mid = await tx.inventory.findUnique({
          where: { food_item_id: food.id },
          select: { stock_qty: true },
        });
        intermediate = mid?.stock_qty ?? before - 2;
        steps.push({
          sql: `UPDATE inventory SET stock_qty = stock_qty - 1 WHERE food_item_id = ${food.id}`,
          result: `2nd decrement applied; stock inside transaction is now ${intermediate}`,
        });
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT sp_lab`;
        steps.push({
          sql: "ROLLBACK TO SAVEPOINT sp_lab",
          result: "2nd decrement undone; 1st decrement kept",
        });
      });
      steps.push({ sql: "COMMIT", result: "transaction committed" });
      after = await readStock(food.id);
      steps.push({
        sql: `SELECT stock_qty FROM inventory WHERE food_item_id = ${food.id}`,
        result: `stock_qty = ${after} (net effect: exactly one decrement, ${before} → ${after})`,
      });
      await prisma.inventory.update({
        where: { food_item_id: food.id },
        data: { stock_qty: { increment: 1 } },
      });
      steps.push({
        sql: `UPDATE inventory SET stock_qty = stock_qty + 1 WHERE food_item_id = ${food.id}`,
        result: "demo stock restored to its pre-demo value (cleanup, not part of the demo)",
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Transaction demo failed",
        steps,
        before,
        after,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    action,
    demoItem: DEMO_FOOD_NAME,
    foodItemId: food.id,
    steps,
    before,
    intermediate,
    after,
    restoredStock: await readStock(food.id),
  });
}
