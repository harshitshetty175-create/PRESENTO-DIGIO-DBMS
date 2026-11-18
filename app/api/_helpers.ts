import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type SessionUser = {
  id: number;
  email: string;
  role: string;
  name: string | null;
};

export type Role =
  | "CUSTOMER"
  | "RESTAURANT_ADMIN"
  | "DELIVERY_PARTNER"
  | "SUPER_ADMIN";

type AuthResult = { session: SessionUser } | { response: NextResponse };

/** Server-side session + role gate. Returns { session } or { response } (an error response to return). */
export async function requireAuth(allowed?: Role[]): Promise<AuthResult> {
  const session = (await getSession()) as SessionUser | null;
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (allowed && !allowed.includes(session.role as Role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

/** Restaurant ids a user manages: owned directly or via the RestaurantAdmin link table. */
export async function ownedRestaurantIds(
  session: SessionUser
): Promise<number[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      OR: [
        { owner_id: session.id },
        { admins: { some: { user_id: session.id } } },
      ],
    },
    select: { id: true },
  });
  return restaurants.map((r) => r.id);
}

/** Decimal / BigInt / Date safe JSON serialiser (recursive, for Prisma rows). */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const maybeDecimal = value as { toNumber?: unknown };
    if (typeof maybeDecimal.toNumber === "function") {
      try {
        return (maybeDecimal as { toNumber(): number }).toNumber();
      } catch {
        return String(value);
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return value;
}

export function serializeRows<T>(rows: T[]): unknown[] {
  return (rows as unknown[]).map((r) =>
    serializeValue(r as Record<string, unknown>)
  );
}

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Best-effort audit write; never fails the request it annotates. */
export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: number,
  details?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity,
        entity_id: entityId ?? null,
        details: details ?? null,
      },
    });
  } catch {
    // Audit logging must never break the primary operation.
  }
}

export function pageParams(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}
