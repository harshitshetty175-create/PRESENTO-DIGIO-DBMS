import { prisma } from "@/lib/prisma";

/** Best-effort notification insert; never throws into the caller. */
export async function notify(
  userId: number,
  title: string,
  body: string,
  type: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { user_id: userId, title, body, type },
    });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

/** Best-effort audit-log insert; never throws into the caller. */
export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  details?: string | Record<string, unknown> | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        details:
          details === undefined || details === null
            ? null
            : typeof details === "string"
              ? details
              : JSON.stringify(details),
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
