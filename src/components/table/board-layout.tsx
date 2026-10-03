"use client";

import { useTransition } from "react";
import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setRowProp } from "@/lib/rows/mutations";
import { formatProp } from "@/lib/props";
import { Avatar } from "@/components/ui/avatar";
import type { PropertyDef, RowData, RowLookup, TableDef } from "@/lib/types";

/** Kanban over any select property. A drop writes the property and logs a `gate` entry. */
export function BoardLayout({
  slug,
  table,
  groups,
  groupDef,
  lookup,
  canEdit,
  onLocalPatch,
  hideKeys = [],
}: {
  slug: string;
  table: TableDef;
  groups: Array<{ key: string; label: string; rows: RowData[] }>;
  groupDef: PropertyDef | undefined;
  lookup: RowLookup;
  canEdit: boolean;
  onLocalPatch: (rowId: string, patch: Partial<RowData>) => void;
  /** properties not worth showing on cards (e.g. fixed by a filter) */
  hideKeys?: string[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [, start] = useTransition();
  const cardDefs = table.properties
    .filter((d) => d.show_in_list && d.key !== groupDef?.key && !hideKeys.includes(d.key) && d.type !== "person")
    .slice(0, 3);
  const personDefs = table.properties.filter((d) => d.type === "person" && d.key !== groupDef?.key && !hideKeys.includes(d.key));

  if (!groupDef) {
    return <div className="rounded-3 border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-3">Add a select property to this table to use the board.</div>;
  }

  function onDragEnd(e: DragEndEvent) {
    const rowId = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    const from = e.active.data.current?.group as string | undefined;
    if (to === null || to === from) return;
    const value = to === "__none__" ? null : to;
    onLocalPatch(rowId, { props: { [groupDef!.key]: value } });
    start(async () => {
      const res = await setRowProp({ rowId, key: groupDef!.key, value, logGate: true });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {groups.map((g) => (
          <Column key={g.key || "__none__"} id={g.key || "__none__"} label={g.label} count={g.rows.length} droppable={canEdit}>
            {g.rows.map((r) => (
              <Card key={r.id} row={r} group={g.key || "__none__"} slug={slug} defs={cardDefs} personDefs={personDefs} lookup={lookup} draggable={canEdit} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}

function Column({ id, label, count, droppable, children }: { id: string; label: string; count: number; droppable: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });
  return (
    <div ref={setNodeRef} className={cn("flex w-[240px] flex-none flex-col rounded-3 border border-line bg-bg-2", isOver && "border-accent")}>
      <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
        <span className="label normal-case tracking-normal text-ink">{label}</span>
        <span className="ml-auto font-mono text-[10.5px] text-ink-4">{count}</span>
      </div>
      <div className="flex min-h-[60px] flex-1 flex-col gap-1 p-1.5">{children}</div>
    </div>
  );
}

function Card({ row, group, slug, defs, personDefs, lookup, draggable }: { row: RowData; group: string; slug: string; defs: PropertyDef[]; personDefs: PropertyDef[]; lookup: RowLookup; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id, data: { group }, disabled: !draggable });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("rounded-2 border border-line bg-surface p-2 text-[12px] shadow-1", draggable && "cursor-grab", isDragging && "opacity-50")}>
      <Link href={`/w/${slug}/r/${encodeURIComponent(row.ref_code)}`} className="block font-medium leading-snug text-ink hover:text-accent" onClick={(e) => isDragging && e.preventDefault()}>
        {row.title}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-ink-3">
        <span className="font-mono">#{row.ref_code}</span>
        {defs.map((d) => {
          const v = formatProp(d, row.props[d.key] ?? null, lookup);
          return v ? <span key={d.key} className="truncate">{d.name}: <span className="text-ink-2">{v}</span></span> : null;
        })}
        <span className="ml-auto flex items-center gap-0.5">
          {personDefs.map((d) => {
            const v = row.props[d.key];
            const p = typeof v === "string" ? lookup[v] : undefined;
            return p ? <Avatar key={d.key} name={p.title} size="sm" /> : null;
          })}
        </span>
      </div>
    </div>
  );
}
