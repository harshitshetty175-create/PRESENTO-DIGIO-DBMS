import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";

export async function GET() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { food_items: true } } },
    orderBy: { name: "asc" },
  });
  return json({ categories });
}
