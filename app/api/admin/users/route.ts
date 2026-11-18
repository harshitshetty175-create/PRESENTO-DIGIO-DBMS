import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, audit, pageParams, serializeRows } from "../../_helpers";

/** GET /api/admin/users?q=&role=&page=&limit= — user list (no password hashes). */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = pageParams(sp);
  const q = sp.get("q")?.trim() ?? "";
  const role = sp.get("role")?.trim() ?? "";

  const where = {
    ...(role
      ? {
          role: role as
            | "CUSTOMER"
            | "RESTAURANT_ADMIN"
            | "DELIVERY_PARTNER"
            | "SUPER_ADMIN",
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_active: true,
        created_at: true,
        _count: { select: { orders: true, restaurants: true } },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    users: serializeRows(users),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}

/** PATCH /api/admin/users { id, is_active } — activate / deactivate a user. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;
  const { session } = auth;

  let body: { id?: unknown; is_active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active must be a boolean" },
      { status: 400 }
    );
  }
  if (id === session.id && body.is_active === false) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, is_active: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { is_active: body.is_active },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
    },
  });

  await audit(
    session.id,
    body.is_active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    "users",
    id,
    `${existing.email} is_active ${existing.is_active} → ${body.is_active}`
  );

  return NextResponse.json({ user: updated });
}
