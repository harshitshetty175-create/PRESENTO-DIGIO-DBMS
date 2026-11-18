import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "../../_helpers";
import {
  ensureDemoFood,
  ensureDemoInventory,
  readStock,
} from "../_demo";

/**
 * POST /api/lab/concurrency { foodItemId?, qty? }
 * Simulates two customers racing for the last item(s). Runs on a CLONED
 * demo inventory row (stock = 1) that is deleted afterwards, so no real
 * order or inventory data ever changes. Both customers fire the same
 * conditional update in parallel:
 *   UPDATE inventory SET stock_qty = stock_qty - ? WHERE food_item_id = ? AND stock_qty >= ?
 * Only one can win — the WHERE clause is the guard that prevents overselling.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  let body: { foodItemId?: unknown; qty?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — defaults apply.
  }
  const qty = Math.min(10, Math.max(1, Number(body.qty ?? 1) || 1));

  // Base food to clone: the caller's item if given, else the demo item.
  let base: Awaited<ReturnType<typeof ensureDemoFood>>;
  if (body.foodItemId !== undefined && body.foodItemId !== null) {
    const id = Number(body.foodItemId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid foodItemId" }, { status: 400 });
    }
    const found = await prisma.foodItem.findUnique({ where: { id } });
    if (!found) {
      return NextResponse.json({ error: "Food item not found" }, { status: 404 });
    }
    base = found as Awaited<ReturnType<typeof ensureDemoFood>>;
  } else {
    base = await ensureDemoFood("Concurrency Demo Item");
  }

  // Clone the item + a fresh inventory row with exactly 1 unit in stock.
  const clone = await prisma.foodItem.create({
    data: {
      restaurant_id: base.restaurant_id,
      category_id: base.category_id,
      name: `Concurrency Demo Clone — simulated (from #${base.id})`,
      description:
        "Temporary clone created by the DBMS Lab concurrency simulation. Deleted when the run finishes.",
      price: base.price,
      veg_type: base.veg_type,
      is_available: false,
    },
  });
  await ensureDemoInventory(clone.id, 1);
  // ensureDemoInventory sets minStock 1; force exactly 1 for a clean race.
  await prisma.inventory.update({
    where: { food_item_id: clone.id },
    data: { stock_qty: 1 },
  });

  try {
    const initialStock = await readStock(clone.id);
    const conditionalDecrement = () =>
      prisma.$executeRaw`UPDATE inventory SET stock_qty = stock_qty - ${qty} WHERE food_item_id = ${clone.id} AND stock_qty >= ${qty}`;

    const [affectedA, affectedB] = await Promise.all([
      conditionalDecrement(),
      conditionalDecrement(),
    ]);
    const finalStock = await readStock(clone.id);

    const results = [
      { customer: "Customer A", success: affectedA > 0, rowsAffected: affectedA },
      { customer: "Customer B", success: affectedB > 0, rowsAffected: affectedB },
    ];
    const winners = results.filter((r) => r.success).length;
    const preventedOversell =
      finalStock >= 0 && winners * qty <= initialStock && winners <= 1;

    return NextResponse.json({
      simulated: true,
      note: "Ran on a temporary cloned demo inventory row (stock 1), deleted after the run. No real orders or inventory were changed.",
      baseFoodItemId: base.id,
      cloneFoodItemId: clone.id,
      qty,
      initialStock,
      results,
      finalStock,
      preventedOversell,
    });
  } finally {
    // Always clean up the clone (its inventory row cascades away with it).
    await prisma.foodItem.delete({ where: { id: clone.id } }).catch(() => undefined);
  }
}
