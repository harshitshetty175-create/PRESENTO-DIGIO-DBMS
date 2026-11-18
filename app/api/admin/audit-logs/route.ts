import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, pageParams, serializeRows } from "../../_helpers";

/** GET /api/admin/audit-logs?page=&entity=&q= — audit trail with user email. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["SUPER_ADMIN"]);
  if ("response" in auth) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = pageParams(sp);
  const entity = sp.get("entity")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";

  const where = {
    ...(entity ? { entity } : {}),
    ...(q
      ? {
          OR: [{ action: { contains: q } }, { details: { contains: q } }],
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    logs: serializeRows(logs),
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}
