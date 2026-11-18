import { NextRequest, NextResponse } from "next/server";

/**
 * Recursively converts Prisma Decimal (has toNumber()) and BigInt values
 * into plain JSON-safe numbers, and Dates into ISO strings.
 */
function deepSerialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepSerialize);
  const maybeDecimal = value as { toNumber?: unknown };
  if (typeof maybeDecimal.toNumber === "function") {
    try {
      return (maybeDecimal.toNumber as () => number)();
    } catch {
      return String(value);
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepSerialize(v);
  }
  return out;
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(deepSerialize(data), { status });
}

export function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Safely parses a JSON request body; returns null when absent/invalid. */
export async function parseBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
