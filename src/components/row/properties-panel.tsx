"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setRowProp } from "@/lib/rows/mutations";
import { riskScore } from "@/lib/props";
import { PropCell } from "@/components/table/prop-cell";
import type { PickerOptions } from "@/lib/rows/pickers";
import type { PropValue, PropertyDef, RowData, RowLookup } from "@/lib/types";

export function PropertiesPanel({ row, defs, lookup, pickers, slug, canEdit }: { row: RowData; defs: PropertyDef[]; lookup: RowLookup; pickers: PickerOptions; slug: string; canEdit: boolean }) {
  const [props, setProps] = useState(row.props);
  const [, start] = useTransition();
  const score = riskScore(props);

  function change(key: string, value: PropValue) {
    setProps((p) => ({ ...p, [key]: value }));
    start(async () => {
      const res = await setRowProp({ rowId: row.id, key, value });
      if (!res.ok) toast.error(res.error);
    });
  }

  if (defs.length === 0) return <p className="text-[12px] text-ink-4">No properties. Add some in Settings.</p>;

  return (
    <dl className="grid grid-cols-[minmax(80px,38%)_1fr] gap-x-2 gap-y-1 text-[12.5px]">
      {defs.map((d) => (
        <div key={d.id} className="contents">
          <dt className="truncate py-0.5 text-ink-3">{d.name}</dt>
          <dd className="min-w-0">
            <PropCell def={d} value={props[d.key] ?? null} lookup={lookup} pickers={pickers} slug={slug} editable={canEdit} onChange={(v) => change(d.key, v)} placeholder="set…" />
          </dd>
        </div>
      ))}
      {score !== null && (
        <div className="contents">
          <dt className="py-0.5 text-ink-3">Score</dt>
          <dd className="font-mono font-medium">{score}</dd>
        </div>
      )}
    </dl>
  );
}
