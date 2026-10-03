"use client";

import { format, isToday, isYesterday } from "date-fns";
import { EntryRow } from "./entry-row";
import type { EntryWithUrls } from "@/lib/entries/fetch";

export function EntryList({
  slug,
  entries,
  ascending = false,
  emptyText = "Nothing logged yet.",
  compact = false,
}: {
  slug: string;
  entries: EntryWithUrls[];
  ascending?: boolean;
  emptyText?: string;
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return <div className="rounded-3 border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-3">{emptyText}</div>;
  }
  const list = ascending ? [...entries].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)) : entries;
  const groups = groupByDay(list);
  return (
    <div>
      {groups.map(([day, rows]) => (
        <section key={day} className="mb-4 last:mb-0">
          <h3 className="label sticky top-0 z-[1] -mx-1 mb-0.5 bg-bg/95 px-1 py-1 backdrop-blur md:top-0">
            {dayLabel(day)}
          </h3>
          <div className="divide-y divide-line rounded-3 border border-line bg-surface">
            {rows.map((e) => (
              <EntryRow key={e.id} entry={e} slug={slug} compact={compact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function dayLabel(day: string): string {
  const d = new Date(day + "T12:00:00");
  if (isToday(d)) return `Today · ${format(d, "EEE d MMM")}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, "EEE d MMM")}`;
  return format(d, "EEEE d MMM yyyy");
}

function groupByDay(entries: EntryWithUrls[]): Array<[string, EntryWithUrls[]]> {
  const map = new Map<string, EntryWithUrls[]>();
  for (const e of entries) {
    const d = new Date(e.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}
