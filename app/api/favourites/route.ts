import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { json, err, parseBody } from "@/lib/http";
import { favouriteSchema } from "@/validations";

/** Narrows an unknown thrown value to a Prisma known-request error. */
function isPrismaKnownError(e: unknown): e is { code: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const favourites = await prisma.favourite.findMany({
    where: { user_id: session.id },
    include: {
      food_item: {
        include: {
          restaurant: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
  return json({ favourites });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = await parseBody(req);
  const parsed = favouriteSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { foodItemId } = parsed.data;

  const food = await prisma.foodItem.findUnique({ where: { id: foodItemId } });
  if (!food) return err("Food item not found", 404);

  try {
    const favourite = await prisma.favourite.create({
      data: { user_id: session.id, food_item_id: foodItemId },
    });
    return json({ favourite }, 201);
  } catch (e) {
    if (isPrismaKnownError(e) && e.code === "P2002") {
      // Already a favourite: return the existing row (idempotent add).
      const favourite = await prisma.favourite.findUnique({
        where: {
          user_id_food_item_id: { user_id: session.id, food_item_id: foodItemId },
        },
      });
      return json({ favourite });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const foodItemId = Number(req.nextUrl.searchParams.get("foodItemId"));
  if (!Number.isInteger(foodItemId)) {
    return err("Missing or invalid foodItemId", 400);
  }
  await prisma.favourite.deleteMany({
    where: { user_id: session.id, food_item_id: foodItemId },
  });
  return json({ ok: true });
}
