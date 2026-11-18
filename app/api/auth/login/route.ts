import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { loginSchema } from "@/validations";

// Simple in-memory rate limit: max 10 login attempts per IP per minute.
// NOTE: this is per server instance only (resets on restart / across
// instances). For production use a shared store (e.g. Redis / Upstash).
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (rateLimited(ip)) {
    return err("Too many login attempts. Please try again in a minute.", 429);
  }

  const body = await parseBody(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return err("Invalid email or password", 401);
  }
  if (!user.is_active) {
    return err("This account has been deactivated", 403);
  }

  const token = await signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  await setAuthCookie(token);
  await audit(user.id, "USER_LOGIN", "users", user.id, null);
  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
