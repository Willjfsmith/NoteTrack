"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, LayoutList, KanbanSquare, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { applyView, groupRows, keyLabel } from "@/lib/props";
import { createRow } from "@/lib/rows/mutations";
import { deleteView, saveView } from "@/lib/views/mutations";
import type { Filter, FilterOp, RowData, RowLookup, TableDef } from "@/lib/types";
import { useViewState } from "./view-state";
import { ListLayout } from "./list-layout";
import { BoardLayout } from "./board-layout";
import type { PickerOptions } from "./prop-cell";

const OPS: Array<{ op: FilterOp; label: string; needsValue: boolean }> = [
  { op: "eq", label: "is", needsValue: true },
  { op: "neq", label: "is not", needsValue: true },
  { op: "contains", label: "contains", needsValue: true },
  { op: "empty", label: "is empty", needsValue: false },
  { op: "not_empty", label: "is not empty", needsValue: false },
  { op: "gt", label: ">", needsValue: true },
  { op: "lt", label: "<", needsValue: true },
];

export function TableView({
  slug,
  workspaceId,
  table,
  rows: initialRows,
  lookup,
  pickers,
  canEdit,
}: {
  slug: string;
  workspaceId: string;
  table: TableDef;
  rows: RowData[];
  lookup: RowLookup;
  pickers: PickerOptions;
  canEdit: boolean;
}) {
  const vs = useViewState(table.views);
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);

  // keep local rows in sync when the server re-renders
  const serverKey = useMemo(() => initialRows.map((r) => r.id + r.updated_at).join("|"), [initialRows]);
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setRows(initialRows);
  }

  const defs = table.properties;
  const visible = useMemo(() => applyView(rows, vs.config, defs, lookup), [rows, vs.config, defs, lookup]);
  const selectDefs = defs.filter((d) => d.type === "select");
  const groupDef = defs.find((d) => d.key === vs.config.group) ?? (vs.layout === "board" ? selectDefs[0] : undefined);
  const groups = useMemo(() => groupRows(visible, groupDef), [visible, groupDef]);
  const filters = vs.config.filters ?? [];
  const sortKeys = [{ key: "title", name: "Title" }, { key: "ref_code", name: "Ref" }, { key: "created_at", name: "Created" }, { key: "updated_at", name: "Updated" }, ...defs.map((d) => ({ key: d.key, name: d.name }))];

  function patchLocal(rowId: string, patch: Partial<RowData>) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch, props: { ...r.props, ...(patch.props ?? {}) } } : r)));
  }

  function addRow() {
    const title = newTitle.trim();
    if (!title) return;
    // when grouped and filtered by a single select value, prefill it
    const props: Record<string, unknown> = {};
    for (const f of filters) if (f.op === "eq" && f.value !== undefined) props[f.key] = f.value;
    start(async () => {
      const res = await createRow({ workspaceId, tableId: table.id, title, props });
      if (!res.ok) { toast.error(res.error); return; }
      setNewTitle("");
      setShowNew(false);
      router.refresh();
    });
  }

  function persistView(asNew: boolean) {
    const name = asNew || !vs.saved ? window.prompt("View name", vs.saved?.name ?? "") : vs.saved.name;
    if (!name) return;
    start(async () => {
      const res = await saveView({
        tableId: table.id,
        viewId: asNew ? undefined : vs.saved?.id,
        name,
        layout: vs.layout,
        config: { filters, sort: vs.config.sort, group: groupDef?.key },
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("View saved");
      vs.setView(res.data.id);
      router.refresh();
    });
  }
  function removeView() {
    if (!vs.saved || !window.confirm(`Delete view "${vs.saved.name}"?`)) return;
    const id = vs.saved.id;
    start(async () => {
      const res = await deleteView({ viewId: id });
      if (!res.ok) { toast.error(res.error); return; }
      vs.setView(null);
      router.refresh();
    });
  }

  return (
    <div className={cn(pending && "opacity-80")}>
      {/* views + layout */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <ViewTab active={!vs.saved} onClick={() => vs.setView(null)}>All</ViewTab>
        {table.views.map((v) => (
          <ViewTab key={v.id} active={vs.saved?.id === v.id} onClick={() => vs.setView(v.id)}>{v.name}</ViewTab>
        ))}
        <span className="flex-1" />
        <input value={vs.config.q ?? ""} onChange={(e) => vs.setQuery(e.target.value)} placeholder="filter…" className="field-sm w-28" />
        <div className="flex rounded-2 border border-line bg-surface">
          <IconBtn active={vs.layout === "list"} onClick={() => vs.setLayout("list")} title="List"><LayoutList className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn active={vs.layout === "board"} onClick={() => vs.setLayout("board")} title="Board"><KanbanSquare className="h-3.5 w-3.5" /></IconBtn>
        </div>
        <Link href={`/w/${slug}/export?kind=table&table=${table.slug}${vs.saved ? `&view=${vs.saved.id}` : ""}`} className="inline-flex items-center gap-1 rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-2 hover:border-line-3" title="Export as Markdown">
          <Download className="h-3 w-3" /> .md
        </Link>
        {canEdit && (
          <button onClick={() => setShowNew((s) => !s)} className="inline-flex items-center gap-1 rounded-2 border border-ink bg-ink px-2 py-1 text-[11.5px] font-medium text-white">
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      {/* filters / sort / group */}
      <div className="mb-2 flex flex-wrap items-center gap-1 text-[11.5px]">
        {filters.map((f, i) => (
          <span key={i} className="chip font-sans normal-case">
            {keyLabel(defs, f.key)} {OPS.find((o) => o.op === f.op)?.label} {f.value !== undefined ? <b>{String(f.value)}</b> : null}
            <button onClick={() => vs.setFilters(filters.filter((_, j) => j !== i))} className="ml-0.5 text-ink-4 hover:text-ink"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
        {addingFilter ? (
          <FilterEditor defs={defs} pickers={pickers} onDone={(f) => { setAddingFilter(false); if (f) vs.setFilters([...filters, f]); }} />
        ) : (
          <button onClick={() => setAddingFilter(true)} className="rounded-2 border border-dashed border-line px-1.5 py-px text-ink-3 hover:border-line-3 hover:text-ink">+ filter</button>
        )}
        <span className="mx-1 text-ink-4">·</span>
        <label className="flex items-center gap-1 text-ink-3">
          sort
          <select value={vs.config.sort?.key ?? ""} onChange={(e) => vs.setSort(e.target.value ? { key: e.target.value, dir: vs.config.sort?.dir ?? "asc" } : null)} className="field-sm">
            <option value="">none</option>
            {sortKeys.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
          </select>
          {vs.config.sort && (
            <button onClick={() => vs.setSort({ key: vs.config.sort!.key, dir: vs.config.sort!.dir === "asc" ? "desc" : "asc" })} className="chip">{vs.config.sort.dir}</button>
          )}
        </label>
        {vs.layout === "board" && (
          <label className="flex items-center gap-1 text-ink-3">
            group by
            <select value={groupDef?.key ?? ""} onChange={(e) => vs.setGroup(e.target.value || null)} className="field-sm">
              {selectDefs.length === 0 && <option value="">(add a select property)</option>}
              {selectDefs.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </label>
        )}
        <span className="flex-1" />
        <span className="font-mono text-[10.5px] text-ink-4">{visible.length} / {rows.length}</span>
        {canEdit && (vs.dirty || !vs.saved) && (
          <button onClick={() => persistView(!vs.saved)} className="inline-flex items-center gap-1 text-ink-3 hover:text-ink" title={vs.saved ? "Update this view" : "Save as a view"}>
            <Save className="h-3 w-3" /> {vs.saved ? "update view" : "save view"}
          </button>
        )}
        {canEdit && vs.saved && (
          <>
            <button onClick={() => persistView(true)} className="text-ink-3 hover:text-ink">save as new</button>
            <button onClick={removeView} className="inline-flex items-center gap-1 text-ink-3 hover:text-tone-red-ink"><Trash2 className="h-3 w-3" /></button>
          </>
        )}
        {vs.dirty && <button onClick={vs.reset} className="text-ink-3 hover:text-ink">reset</button>}
      </div>

      {showNew && canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); addRow(); }} className="mb-2 flex items-center gap-1.5 rounded-3 border border-line bg-surface p-1.5">
          <span className="chip">{table.ref_prefix}-?</span>
          <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={`New ${table.name.replace(/s$/, "").toLowerCase()} title`} className="field py-1" />
          <button type="submit" disabled={!newTitle.trim() || pending} className="rounded-2 border border-ink bg-ink px-2 py-1 text-[11.5px] font-medium text-white disabled:opacity-40">Add</button>
          <button type="button" onClick={() => setShowNew(false)} className="text-[11.5px] text-ink-3">cancel</button>
        </form>
      )}

      {vs.layout === "board" ? (
        <BoardLayout slug={slug} table={table} groups={groups} groupDef={groupDef} lookup={lookup} canEdit={canEdit} onLocalPatch={patchLocal} />
      ) : (
        <ListLayout slug={slug} table={table} rows={visible} lookup={lookup} pickers={pickers} canEdit={canEdit} onLocalPatch={patchLocal} />
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-2 px-2 py-1 text-[12px]", active ? "bg-bg-3 font-medium text-ink" : "text-ink-3 hover:bg-bg-2 hover:text-ink")}>
      {children}
    </button>
  );
}
function IconBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className={cn("px-1.5 py-1 first:rounded-l-2 last:rounded-r-2", active ? "bg-bg-3 text-ink" : "text-ink-3 hover:text-ink")}>
      {children}
    </button>
  );
}

function FilterEditor({ defs, pickers, onDone }: { defs: TableDef["properties"]; pickers: PickerOptions; onDone: (f: Filter | null) => void }) {
  const [key, setKey] = useState(defs[0]?.key ?? "title");
  const [op, setOp] = useState<FilterOp>("eq");
  const [value, setValue] = useState("");
  const def = defs.find((d) => d.key === key);
  const needsValue = OPS.find((o) => o.op === op)?.needsValue ?? true;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-2 border border-line bg-surface p-1">
      <select value={key} onChange={(e) => setKey(e.target.value)} className="field-sm">
        <option value="title">Title</option>
        <option value="ref_code">Ref</option>
        {defs.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
      </select>
      <select value={op} onChange={(e) => setOp(e.target.value as FilterOp)} className="field-sm">
        {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {needsValue && def?.type === "select" ? (
        <select value={value} onChange={(e) => setValue(e.target.value)} className="field-sm">
          <option value="">choose…</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : needsValue && def && (def.type === "person" || def.type === "relation") ? (
        <select value={value} onChange={(e) => setValue(e.target.value)} className="field-sm">
          <option value="">choose…</option>
          {(pickers[def.key] ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      ) : needsValue ? (
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} type={def?.type === "date" ? "date" : "text"} className="field-sm w-28" onKeyDown={(e) => { if (e.key === "Enter") onDone({ key, op, value }); }} />
      ) : null}
      <button onClick={() => onDone(needsValue && !value ? null : { key, op, value: needsValue ? value : undefined })} className="rounded-2 border border-ink bg-ink px-1.5 py-px text-white">add</button>
      <button onClick={() => onDone(null)} className="text-ink-3">cancel</button>
    </span>
  );
}
