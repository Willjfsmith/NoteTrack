"use client";

import { parseAsString, useQueryStates } from "nuqs";

export function DiaryFilters({ projects }: { projects: Array<{ ref: string; title: string }> }) {
  const [q, setQ] = useQueryStates(
    { project: parseAsString.withDefault(""), from: parseAsString.withDefault(""), to: parseAsString.withDefault("") },
    { history: "replace", shallow: false },
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
        <button onClick={() => setQ({ project: null, from: null, to: null })} className="text-[11.5px] text-ink-3 hover:text-ink">
          clear
        </button>
      )}
    </div>
  );
}
