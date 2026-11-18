import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { notificationPatchSchema } from "@/validations";

export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const notifications = await prisma.notification.findMany({
    where: { user_id: session.id },
    orderBy: { created_at: "desc" },
    take: 50,
  });
  return json({ notifications });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = notificationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { id, all } = parsed.data;

  if (all) {
    await prisma.notification.updateMany({
      where: { user_id: session.id, is_read: false },
      data: { is_read: true },
    });
    return json({ ok: true, message: "All notifications marked as read." });
  }
  if (id) {
    const notification = await prisma.notification.findFirst({
      where: { id, user_id: session.id },
    });
    if (!notification) return err("Notification not found", 404);
    const updated = await prisma.notification.update({
      where: { id },
      data: { is_read: true },
    });
    return json({ notification: updated });
  }
  return err("Provide an id or { all: true }", 400);
}
