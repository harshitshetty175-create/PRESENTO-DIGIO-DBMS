import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role, SessionUser } from "@/types";

export const AUTH_COOKIE = "foodflow_token";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Dev-only fallback so local development works without env setup.
    // Production must set AUTH_SECRET; tokens signed with the fallback
    // must never be trusted in production.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not configured");
    }
    return new TextEncoder().encode("foodflow-dev-only-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(user: {
  id: number;
  email: string;
  role: Role;
  name: string;
}): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = payload.id;
    const email = payload.email;
    const role = payload.role;
    const name = payload.name;
    if (
      typeof id !== "number" ||
      typeof email !== "string" ||
      typeof role !== "string" ||
      typeof name !== "string"
    ) {
      return null;
    }
    if (
      role !== "CUSTOMER" &&
      role !== "RESTAURANT_ADMIN" &&
      role !== "DELIVERY_PARTNER" &&
      role !== "SUPER_ADMIN"
    ) {
      return null;
    }
    return { id, email, role: role as Role, name };
  } catch {
    return null;
  }
}

/** Reads the `foodflow_token` cookie and returns the session user, or null. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Returns the session user or throws an Error("Unauthorized"). */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}
