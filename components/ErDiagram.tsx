"use client";

import { useState } from "react";
import {
  ENTITIES,
  RELATIONS,
  DIAGRAM_WIDTH,
  DIAGRAM_HEIGHT,
  HEADER_H,
  ROW_H,
} from "./er-data";

/** SVG ER diagram for the 21 entities of food_ordering_db. Zoom via scale buttons; pan by scrolling the container. */
export default function ErDiagram() {
  const [scale, setScale] = useState(0.85);
  const [selected, setSelected] = useState<string | null>(null);

  const byName = new Map(ENTITIES.map((e) => [e.name, e]));

  function rowY(entityName: string, columnName: string): number {
    const e = byName.get(entityName);
    if (!e) return 0;
    const idx = e.columns.findIndex((c) => c.name === columnName);
    return e.y + HEADER_H + Math.max(0, idx) * ROW_H + ROW_H / 2;
  }

  const visibleRelations = selected
    ? RELATIONS.filter(
        (r) => r.fromEntity === selected || r.toEntity === selected
      )
    : RELATIONS;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)))}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-sm"
        >
          − Zoom out
        </button>
        <span className="text-sm text-stone-600">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(1.6, +(s + 0.15).toFixed(2)))}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-sm"
        >
          + Zoom in
        </button>
        <button
          type="button"
          onClick={() => setScale(0.85)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-sm"
        >
          Reset
        </button>
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-lg bg-brand-100 px-3 py-1 text-sm text-brand-800"
          >
            Showing relations for “{selected}” — clear
          </button>
        ) : (
          <span className="text-xs text-stone-500">
            Click an entity to highlight its relations. Gold = PK, blue = FK.
          </span>
        )}
      </div>

      <div className="overflow-auto rounded-2xl border border-stone-200 bg-white shadow-card">
        <div style={{ width: DIAGRAM_WIDTH * scale, height: DIAGRAM_HEIGHT * scale }}>
          <svg
            width={DIAGRAM_WIDTH * scale}
            height={DIAGRAM_HEIGHT * scale}
            viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
            role="img"
            aria-label="Entity relationship diagram for food_ordering_db"
          >
            {visibleRelations.map((r, i) => {
              const from = byName.get(r.fromEntity);
              const to = byName.get(r.toEntity);
              if (!from || !to) return null;
              const y1 = rowY(r.fromEntity, r.fromColumn);
              const y2 = rowY(r.toEntity, r.toColumn);
              // Route from the FK side's nearest edge to the PK side's nearest edge.
              const fromRight = from.x + from.width;
              const toLeft = to.x;
              const fromLeft = from.x;
              const toRight = to.x + to.width;
              const useRightSide = from.x < to.x;
              const x1 = useRightSide ? fromRight : fromLeft;
              const x2 = useRightSide ? toLeft : toRight;
              const mx = (x1 + x2) / 2;
              const dimmed = selected !== null && r.fromEntity !== selected && r.toEntity !== selected;
              return (
                <path
                  key={`${r.fromEntity}.${r.fromColumn}->${r.toEntity}.${r.toColumn}-${i}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={dimmed ? "#d6d3d1" : "#2563eb"}
                  strokeWidth={dimmed ? 1 : 1.5}
                  opacity={dimmed ? 0.4 : 0.75}
                />
              );
            })}

            {ENTITIES.map((e) => {
              const active = selected === e.name;
              return (
                <g
                  key={e.name}
                  onClick={() => setSelected(active ? null : e.name)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={e.x}
                    y={e.y}
                    width={e.width}
                    height={e.height}
                    rx={10}
                    fill="#ffffff"
                    stroke={active ? "#ea580c" : "#d6d3d1"}
                    strokeWidth={active ? 2.5 : 1.25}
                  />
                  <rect
                    x={e.x}
                    y={e.y}
                    width={e.width}
                    height={HEADER_H}
                    rx={10}
                    fill="#1c1917"
                  />
                  <rect
                    x={e.x}
                    y={e.y + HEADER_H - 10}
                    width={e.width}
                    height={10}
                    fill="#1c1917"
                  />
                  <text
                    x={e.x + 12}
                    y={e.y + 23}
                    fill="#ffffff"
                    fontSize={14}
                    fontWeight={700}
                    fontFamily="system-ui, sans-serif"
                  >
                    {e.name}
                  </text>
                  {e.columns.map((c, idx) => {
                    const cy = e.y + HEADER_H + idx * ROW_H + 14;
                    return (
                      <g key={c.name}>
                        <text
                          x={e.x + 12}
                          y={cy}
                          fontSize={11.5}
                          fill="#44403c"
                          fontFamily="ui-monospace, monospace"
                        >
                          {c.name}
                        </text>
                        <text
                          x={e.x + e.width - 12}
                          y={cy}
                          textAnchor="end"
                          fontSize={10.5}
                          fill="#a8a29e"
                          fontFamily="ui-monospace, monospace"
                        >
                          {c.type}
                        </text>
                        {c.pk ? (
                          <g>
                            <rect x={e.x + e.width - 118} y={cy - 11} width={22} height={13} rx={3} fill="#f59e0b" />
                            <text x={e.x + e.width - 107} y={cy - 1} fontSize={8.5} fontWeight={700} fill="#ffffff" textAnchor="middle">PK</text>
                          </g>
                        ) : null}
                        {c.fk ? (
                          <g>
                            <rect x={e.x + e.width - 92} y={cy - 11} width={22} height={13} rx={3} fill="#2563eb" />
                            <text x={e.x + e.width - 81} y={cy - 1} fontSize={8.5} fontWeight={700} fill="#ffffff" textAnchor="middle">FK</text>
                          </g>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">PK</span>
        <span>Primary key</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">FK</span>
        <span>Foreign key — a line connects it to the referenced table’s PK</span>
      </div>
    </div>
  );
}
