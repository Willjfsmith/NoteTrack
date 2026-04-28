"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EntryRow } from "./entry-row";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EntryRowData } from "@/lib/entries/types";

export function Diary({
  projectId,
  projectCode,
  initial,
  meetingId,
}: {
  projectId: string;
  projectCode: string;
  initial: EntryRowData[];
  meetingId?: string;
}) {
  const [entries, setEntries] = useState<EntryRowData[]>(initial);
  const supabase = createSupabaseBrowserClient();

  // Realtime — listen for any new entries on this project (Prompt 13's foothold).
  useEffect(() => {
    const ch = supabase
      .channel(`entries-${projectId}-${meetingId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "entries",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: EntryRowData["type"];
            body_md: string;
            occurred_at: string;
            source_meeting_id: string | null;
          };
          if (meetingId && row.source_meeting_id !== meetingId) return;
          setEntries((prev) => {
            if (prev.some((e) => e.id === row.id)) return prev;
            return [
              {
                id: row.id,
                type: row.type,
                body_md: row.body_md,
                occurred_at: row.occurred_at,
                action: null,
                risk: null,
                decision: null,
                gate: null,
              },
              ...prev,
            ];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, projectId, meetingId]);

  if (entries.length === 0) {
    return (
      <div className="rounded-4 border border-dashed border-line p-8 text-center text-ink-3">
        <p className="text-[14px]">No entries yet.</p>
        <p className="mt-1 text-[12.5px]">
          Type something into the composer above — try{" "}
          <code className="rounded bg-bg-2 px-1 font-mono text-[11px]">/risk</code>,{" "}
          <code className="rounded bg-bg-2 px-1 font-mono text-[11px]">/todo</code>, or just plain
          text.
        </p>
      </div>
    );
  }

  // Group by day for the section headers.
  const groups = groupByDay(entries);

  return (
    <div>
      {groups.map(([day, rows]) => (
        <section key={day} className="mb-6 last:mb-0">
          <h3 className="sticky top-12 z-10 -mx-1 mb-1 bg-bg/90 px-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4 backdrop-blur">
            {format(new Date(day), "EEEE · d MMM")}
          </h3>
          {rows.map((e) => (
            <EntryRow key={e.id} entry={e} projectCode={projectCode} />
          ))}
        </section>
      ))}
    </div>
  );
}

function groupByDay(entries: EntryRowData[]): Array<[string, EntryRowData[]]> {
  const map = new Map<string, EntryRowData[]>();
  for (const e of entries) {
    const day = e.occurred_at.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(e);
    map.set(day, arr);
  }
  return Array.from(map.entries());
}
