"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setRowProp, updateRow } from "@/lib/rows/mutations";
import { riskScore } from "@/lib/props";
import type { PropValue, RowData, RowLookup, TableDef } from "@/lib/types";
import { PropCell, type PickerOptions } from "./prop-cell";

export function ListLayout({
  slug,
  table,
  rows,
  lookup,
  pickers,
  canEdit,
  onLocalPatch,
}: {
  slug: string;
  table: TableDef;
  rows: RowData[];
  lookup: RowLookup;
  pickers: PickerOptions;
  canEdit: boolean;
  onLocalPatch: (rowId: string, patch: Partial<RowData>) => void;
}) {
  const cols = table.properties.filter((d) => d.show_in_list);
  const [, start] = useTransition();
  const isRisks = table.kind === "risks";

  function setProp(row: RowData, key: string, value: PropValue) {
    onLocalPatch(row.id, { props: { [key]: value } });
    start(async () => {
      const res = await setRowProp({ rowId: row.id, key, value });
      if (!res.ok) toast.error(res.error);
    });
  }

  if (rows.length === 0) {
    return <div className="rounded-3 border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-3">No rows match.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-3 border border-line bg-surface">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-line bg-bg-2 text-left">
            <th className="label px-2 py-1.5 font-medium">Ref</th>
            <th className="label px-2 py-1.5 font-medium">Title</th>
            {cols.map((c) => (
              <th key={c.id} className="label whitespace-nowrap px-2 py-1.5 font-medium">{c.name}</th>
            ))}
            {isRisks && <th className="label px-2 py-1.5 font-medium">Score</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group border-b border-line last:border-b-0 hover:bg-bg-2/60">
              <td className="whitespace-nowrap px-2 py-1 align-top">
                <Link href={`/w/${slug}/r/${encodeURIComponent(r.ref_code)}`} className="chip hover:border-accent-bd hover:text-accent">#{r.ref_code}</Link>
              </td>
              <td className="min-w-[200px] px-2 py-1 align-top">
                <TitleCell row={r} slug={slug} canEdit={canEdit} onLocalPatch={onLocalPatch} />
              </td>
              {cols.map((c) => (
                <td key={c.id} className={cn("px-2 py-1 align-top", c.type === "number" && "w-20")}>
                  <PropCell def={c} value={r.props[c.key] ?? null} lookup={lookup} pickers={pickers} slug={slug} editable={canEdit} onChange={(v) => setProp(r, c.key, v)} />
                </td>
              ))}
              {isRisks && <td className="px-2 py-1 align-top"><Score props={r.props} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Score({ props }: { props: RowData["props"] }) {
  const s = riskScore(props);
  if (s === null) return <span className="text-ink-4">—</span>;
  return <span className={cn("font-mono text-[12px] font-medium", s >= 12 ? "text-tone-red-ink" : s >= 6 ? "text-tone-amber-ink" : "text-ink-2")}>{s}</span>;
}

function TitleCell({ row, slug, canEdit, onLocalPatch }: { row: RowData; slug: string; canEdit: boolean; onLocalPatch: (id: string, p: Partial<RowData>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title);
  const [, start] = useTransition();
  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (!t || t === row.title) { setDraft(row.title); return; }
    onLocalPatch(row.id, { title: t });
    start(async () => {
      const res = await updateRow({ rowId: row.id, title: t });
      if (!res.ok) toast.error(res.error);
    });
  }
  if (editing) {
    return <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(row.title); setEditing(false); } }} className="field-sm w-full" />;
  }
  return (
    <div className="flex items-center gap-1">
      <Link href={`/w/${slug}/r/${encodeURIComponent(row.ref_code)}`} className="min-w-0 truncate font-medium text-ink hover:text-accent hover:underline">{row.title}</Link>
      {canEdit && <button onClick={() => setEditing(true)} className="text-[10.5px] text-ink-4 opacity-0 hover:text-ink group-hover:opacity-100">edit</button>}
    </div>
  );
}
