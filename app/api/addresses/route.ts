import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { addressSchema } from "@/validations";

export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const addresses = await prisma.address.findMany({
    where: { user_id: session.id },
    orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
  });
  return json({ addresses });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const d = parsed.data;

  const address = await prisma.$transaction(async (tx) => {
    if (d.is_default) {
      await tx.address.updateMany({
        where: { user_id: session.id, is_default: true },
        data: { is_default: false },
      });
    }
    return tx.address.create({
      data: {
        user_id: session.id,
        label: d.label,
        line1: d.line1,
        line2: d.line2 ?? null,
        city: d.city,
        pincode: d.pincode,
        is_default: d.is_default ?? false,
      },
    });
  });
  return json({ address }, 201);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return err("Missing or invalid address id", 400);

  const address = await prisma.address.findFirst({
    where: { id, user_id: session.id },
  });
  if (!address) return err("Address not found", 404);

  await prisma.address.delete({ where: { id } });
  return json({ ok: true });
}
