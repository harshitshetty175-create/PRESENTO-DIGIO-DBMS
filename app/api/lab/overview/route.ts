import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "../../_helpers";
import { TABLE_META, TABLE_NAMES, countTable } from "../_meta";

type ColumnRow = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_KEY: string;
};

type FkRow = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
};

/**
 * GET /api/lab/overview — database metadata for food_ordering_db.
 * Tries MySQL information_schema for real metadata; falls back to Prisma
 * counts + the hand-written column map from prisma/schema.prisma.
 * Row counts are always real (Prisma count per model).
 */
export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const counts = await Promise.all(
    TABLE_NAMES.map(async (name) => ({ name, rows: await countTable(name) }))
  );
  const countByTable = new Map(counts.map((c) => [c.name, c.rows]));

  try {
    const columns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;
    const fks = await prisma.$queryRaw<FkRow[]>`
      SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    `;
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("information_schema returned no columns");
    }

    const byTable = new Map<string, ColumnRow[]>();
    for (const c of columns) {
      const list = byTable.get(c.TABLE_NAME) ?? [];
      list.push(c);
      byTable.set(c.TABLE_NAME, list);
    }
    const fkByTable = new Map<string, { column: string; references: string }[]>();
    for (const f of fks) {
      const list = fkByTable.get(f.TABLE_NAME) ?? [];
      list.push({
        column: f.COLUMN_NAME,
        references: `${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`,
      });
      fkByTable.set(f.TABLE_NAME, list);
    }

    const tables = TABLE_NAMES.filter((t) => byTable.has(t)).map((name) => {
      const cols = byTable.get(name) ?? [];
      return {
        name,
        rows: countByTable.get(name) ?? 0,
        columns: cols.map((c) => ({
          name: c.COLUMN_NAME,
          type: (c.COLUMN_TYPE || c.DATA_TYPE || "").toLowerCase(),
          nullable: c.IS_NULLABLE === "YES",
          key: c.COLUMN_KEY || "",
        })),
        primaryKey:
          cols.find((c) => c.COLUMN_KEY === "PRI")?.COLUMN_NAME ?? null,
        foreignKeys: fkByTable.get(name) ?? [],
      };
    });

    return NextResponse.json({
      database: "food_ordering_db",
      source: "information_schema",
      tables,
    });
  } catch {
    // Prisma fallback: real counts + hand-written schema map.
    const tables = TABLE_NAMES.map((name) => ({
      name,
      rows: countByTable.get(name) ?? 0,
      columns: TABLE_META[name].columns,
      primaryKey: TABLE_META[name].primaryKey,
      foreignKeys: TABLE_META[name].foreignKeys,
    }));
    return NextResponse.json({
      database: "food_ordering_db",
      source: "prisma-fallback",
      tables,
    });
  }
}
