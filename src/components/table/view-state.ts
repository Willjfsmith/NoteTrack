"use client";

import { parseAsString, parseAsArrayOf, useQueryStates } from "nuqs";
import type { Filter, FilterOp, Sort, ViewConfig, ViewDef, ViewLayout } from "@/lib/types";

/** URL ↔ view config. A saved view supplies defaults; URL params override them. */
export function useViewState(views: ViewDef[]) {
  const [s, set] = useQueryStates(
    {
      view: parseAsString.withDefault(""),
      layout: parseAsString.withDefault(""),
      group: parseAsString.withDefault(""),
      sort: parseAsString.withDefault(""),
      dir: parseAsString.withDefault(""),
      q: parseAsString.withDefault(""),
      f: parseAsArrayOf(parseAsString).withDefault([]),
    },
    { history: "replace" },
  );
  const saved = views.find((v) => v.id === s.view) ?? null;
  const base: ViewConfig = saved?.config ?? {};
  const urlFilters = s.f.map(decodeFilter).filter((f): f is Filter => Boolean(f));
  const hasUrlFilters = s.f.length > 0;

  const config: ViewConfig = {
    filters: hasUrlFilters ? urlFilters.filter((f) => f.op !== "noop" as FilterOp) : base.filters,
    sort: s.sort ? ({ key: s.sort, dir: (s.dir as Sort["dir"]) || "asc" } as Sort) : base.sort,
    group: s.group !== "" ? (s.group === "-" ? undefined : s.group) : base.group,
    q: s.q || undefined,
  };
  const layout: ViewLayout = (s.layout as ViewLayout) || saved?.layout || "list";

  return {
    saved,
    layout,
    config,
    dirty: Boolean(s.layout || s.group || s.sort || hasUrlFilters),
    setView: (id: string | null) => set({ view: id, layout: null, group: null, sort: null, dir: null, f: null, q: null }),
    setLayout: (l: ViewLayout) => set({ layout: l }),
    setGroup: (g: string | null) => set({ group: g === null ? "-" : g }),
    setSort: (sort: Sort | null) => set({ sort: sort?.key ?? null, dir: sort?.dir ?? null }),
    setQuery: (q: string) => set({ q: q || null }),
    setFilters: (filters: Filter[]) => set({ f: filters.length ? filters.map(encodeFilter) : ["noop"] }),
    reset: () => set({ layout: null, group: null, sort: null, dir: null, f: null, q: null }),
  };
}

function encodeFilter(f: Filter): string {
  return [f.key, f.op, f.value === undefined ? "" : String(f.value)].map(encodeURIComponent).join(":");
}
function decodeFilter(s: string): Filter | null {
  if (s === "noop") return { key: "", op: "noop" as FilterOp };
  const [key, op, value] = s.split(":").map((x) => decodeURIComponent(x ?? ""));
  if (!key || !op) return null;
  const f: Filter = { key, op: op as FilterOp };
  if (value !== "" && op !== "empty" && op !== "not_empty") f.value = value;
  return f;
}
