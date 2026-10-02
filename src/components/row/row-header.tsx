"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { archiveRow, updateRow } from "@/lib/rows/mutations";
import type { RowData } from "@/lib/types";

/** Editable title + archive toggle for a row page. */
export function RowHeader({ row, canEdit }: { row: RowData; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [ref, setRef] = useState(row.ref_code);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const t = title.trim();
    const r = ref.trim();
    if (!t || !r) return;
    start(async () => {
      const res = await updateRow({ rowId: row.id, title: t, refCode: r });
      if (!res.ok) { toast.error(res.error); return; }
      setEditing(false);
      if (r !== row.ref_code) router.replace(`${window.location.pathname.replace(/\/r\/[^/]+$/, "")}/r/${encodeURIComponent(r)}`);
      else router.refresh();
    });
  }
  function toggleArchive() {
    start(async () => {
      const res = await archiveRow({ rowId: row.id, archived: !row.archived_at });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-wrap items-center gap-1.5">
        <input value={ref} onChange={(e) => setRef(e.target.value)} className="field-sm w-28 font-mono" aria-label="Ref" />
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="field min-w-[240px] flex-1 text-[15px] font-semibold" aria-label="Title" />
        <button type="submit" disabled={pending} className="rounded-2 border border-ink bg-ink px-2 py-1 text-[11.5px] text-white">Save</button>
        <button type="button" onClick={() => { setEditing(false); setTitle(row.title); setRef(row.ref_code); }} className="text-[11.5px] text-ink-3">cancel</button>
      </form>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={row.archived_at ? "line-through text-ink-3" : ""}>{row.title}</span>
      {canEdit && (
        <>
          <button onClick={() => setEditing(true)} className="rounded-2 p-0.5 text-ink-4 hover:bg-bg-2 hover:text-ink" title="Edit title or ref"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={toggleArchive} disabled={pending} className="rounded-2 p-0.5 text-ink-4 hover:bg-bg-2 hover:text-ink" title={row.archived_at ? "Restore" : "Archive"}>
            {row.archived_at ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
    </span>
  );
}
