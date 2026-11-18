import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, phone: true, role: true, is_active: true },
  });
  if (!user) return err("Unauthorized", 401);
  if (!user.is_active) return err("This account has been deactivated", 403);
  return json({ user });
}
