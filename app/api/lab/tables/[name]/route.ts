import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, pageParams, serializeValue } from "../../../_helpers";
import { TABLE_META, TABLE_NAMES, countTable } from "../../_meta";

type FinderArgs = { skip: number; take: number; orderBy: Record<string, string> };
type Finder = (args: FinderArgs) => Promise<unknown[]>;

/**
 * GET /api/lab/tables/[name]?page=&limit=&sort=&dir=
 * Paginated rows of an allowlisted table (same allowlist as lib/sql-guard).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { name } = await params;
  if (!TABLE_NAMES.includes(name)) {
    return NextResponse.json(
      { error: `Unknown table "${name}". Allowlisted tables: ${TABLE_NAMES.join(", ")}` },
      { status: 400 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = pageParams(sp);
  const meta = TABLE_META[name];
  const validColumns = new Set(meta.columns.map((c) => c.name));
  const sort = sp.get("sort") ?? "id";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  const orderBy: Record<string, string> = validColumns.has(sort)
    ? { [sort]: dir }
    : { id: "desc" };

  let finder: Finder;
  switch (name) {
    case "users":
      finder = (a) => prisma.user.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "addresses":
      finder = (a) => prisma.address.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "restaurants":
      finder = (a) => prisma.restaurant.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "restaurant_admins":
      finder = (a) => prisma.restaurantAdmin.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "categories":
      finder = (a) => prisma.category.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "food_items":
      finder = (a) => prisma.foodItem.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "inventory":
      finder = (a) => prisma.inventory.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "carts":
      finder = (a) => prisma.cart.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "cart_items":
      finder = (a) => prisma.cartItem.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "orders":
      finder = (a) => prisma.order.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "order_items":
      finder = (a) => prisma.orderItem.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "payments":
      finder = (a) => prisma.payment.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "delivery_partners":
      finder = (a) => prisma.deliveryPartner.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "deliveries":
      finder = (a) => prisma.delivery.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "coupons":
      finder = (a) => prisma.coupon.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "coupon_usage":
      finder = (a) => prisma.couponUsage.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "reviews":
      finder = (a) => prisma.review.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "favourites":
      finder = (a) => prisma.favourite.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "notifications":
      finder = (a) => prisma.notification.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "order_status_history":
      finder = (a) => prisma.orderStatusHistory.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    case "audit_logs":
      finder = (a) => prisma.auditLog.findMany({ ...a, orderBy: a.orderBy as never });
      break;
    default:
      return NextResponse.json({ error: `Unknown table "${name}"` }, { status: 400 });
  }

  const [total, rows] = await Promise.all([
    countTable(name),
    finder({ skip, take: limit, orderBy }),
  ]);

  // Never expose password hashes through the table explorer.
  const safeRows = (rows as Record<string, unknown>[]).map((row) => {
    if (name === "users" && "password_hash" in row) {
      const { password_hash: _removed, ...rest } = row;
      return rest;
    }
    return row;
  });

  return NextResponse.json({
    table: name,
    columns: meta.columns,
    rows: safeRows.map((r) => serializeValue(r)),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
