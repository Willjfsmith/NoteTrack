"use client";

import { parseAsString, useQueryStates } from "nuqs";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfWeek(d: Date): Date {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // Monday
  return t;
}
const PRESETS: Array<{ key: string; label: string; range: () => [string, string] }> = [
  { key: "today", label: "Today", range: () => [iso(new Date()), iso(new Date())] },
  { key: "week", label: "This week", range: () => { const s = startOfWeek(new Date()); const e = new Date(s); e.setDate(s.getDate() + 6); return [iso(s), iso(e)]; } },
  { key: "lastweek", label: "Last week", range: () => { const s = startOfWeek(new Date()); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return [iso(s), iso(e)]; } },
  { key: "30", label: "30 days", range: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 29); return [iso(s), iso(e)]; } },
];

export function DiaryFilters({ projects }: { projects: Array<{ ref: string; title: string }> }) {
  const [q, setQ] = useQueryStates(
    { project: parseAsString.withDefault(""), from: parseAsString.withDefault(""), to: parseAsString.withDefault(""), n: parseAsString.withDefault("") },
    { history: "replace", shallow: false },
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex rounded-2 border border-line bg-surface">
        {PRESETS.map((p) => {
          const [f, t] = p.range();
          const on = q.from === f && q.to === t;
          return (
            <button key={p.key} onClick={() => setQ({ from: on ? null : f, to: on ? null : t, n: null })} className={on ? "bg-bg-3 px-2 py-1 text-[11.5px] font-medium text-ink first:rounded-l-2 last:rounded-r-2" : "px-2 py-1 text-[11.5px] text-ink-3 hover:text-ink"}>
              {p.label}
            </button>
          );
        })}
      </div>
      {projects.length > 0 && (
        <select value={q.project} onChange={(e) => setQ({ project: e.target.value || null })} className="field-sm">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.ref} value={p.ref}>
              {p.title}
            </option>
          ))}
        </select>
      )}
      <input type="date" value={q.from} onChange={(e) => setQ({ from: e.target.value || null })} className="field-sm" title="From" />
      <span className="text-[11px] text-ink-4">→</span>
      <input type="date" value={q.to} onChange={(e) => setQ({ to: e.target.value || null })} className="field-sm" title="To" />
      {(q.project || q.from || q.to) && (
        <button onClick={() => setQ({ project: null, from: null, to: null, n: null })} className="text-[11.5px] text-ink-3 hover:text-ink">
          clear
        </button>
      )}
    </div>
  );
}
