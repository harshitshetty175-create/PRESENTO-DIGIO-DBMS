import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { audit } from "@/lib/notify";
import { registerSchema } from "@/validations";

/** Narrows an unknown thrown value to a Prisma known-request error. */
function isPrismaKnownError(e: unknown): e is { code: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);

  // SUPER_ADMIN can never self-register (checked before zod, whose role
  // enum does not include SUPER_ADMIN, so a 403 is returned, not a 400).
  const rawRole =
    typeof body === "object" && body !== null
      ? (body as { role?: unknown }).role
      : undefined;
  if (rawRole === "SUPER_ADMIN") {
    return err("SUPER_ADMIN accounts cannot self-register", 403);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { name, email, phone, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return err("An account with this email already exists", 409);
  }

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        password_hash: await hashPassword(password),
        role,
      },
    });
    const token = await signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    await setAuthCookie(token);
    await audit(user.id, "USER_REGISTER", "users", user.id, {
      email: user.email,
      role: user.role,
    });
    return json(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      201,
    );
  } catch (e) {
    if (isPrismaKnownError(e) && e.code === "P2002") {
      return err("An account with this email already exists", 409);
    }
    console.error("[auth/register]", e);
    return err("Registration failed", 500);
  }
}
