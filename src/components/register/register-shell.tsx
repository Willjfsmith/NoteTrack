"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

export type RegisterRow = {
  id: string;
  /** When grouping by buckets (Late/Today/etc.). */
  bucket: string;
  /** Sort key inside a bucket. Optional — defaults to title. */
  sortKey?: string | number;
  /** Element rendered as the row's body. */
  render: React.ReactNode;
  /** Optional row tone hints. */
  late?: boolean;
};

export type RegisterTab = {
  key: string;
  label: string;
  count?: number;
};

export type RegisterFilter = {
  key: string;
  label: string;
};

export type Shortcut = {
  /** Lowercase letter. */
  key: string;
  label: string;
  run: (rowId: string | null) => void;
};

export function RegisterShell({
  title,
  totalCount,
  tabs,
  activeTab,
  onTabChange,
  filters,
  activeFilters,
  onFilterToggle,
  query,
  onQueryChange,
  buckets,
  selectedId,
  onSelectionChange,
  detail,
  shortcuts,
  topBanner,
}: {
  title: string;
  totalCount: number;
  tabs: RegisterTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  filters?: RegisterFilter[];
  activeFilters?: string[];
  onFilterToggle?: (key: string) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
  buckets: Array<{ label: string; rows: RegisterRow[] }>;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  detail: React.ReactNode;
  shortcuts?: Shortcut[];
  topBanner?: React.ReactNode;
}) {
  const flatRows = useMemo(() => buckets.flatMap((b) => b.rows), [buckets]);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in input/textarea.
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      const idx = flatRows.findIndex((r) => r.id === selectedId);
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        const next = flatRows[Math.min(idx + 1, flatRows.length - 1)];
        if (next) onSelectionChange(next.id);
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        const prev = flatRows[Math.max(idx - 1, 0)];
        if (prev) onSelectionChange(prev.id);
      } else if (shortcuts) {
        const sc = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
        if (sc) {
          // Don't fire shortcut for plain keystrokes that conflict with browser nav.
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          e.preventDefault();
          sc.run(selectedId);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatRows, selectedId, onSelectionChange, shortcuts]);

  return (
    <div className="grid h-[calc(100vh-49px-18px-60px)] min-h-[600px] grid-cols-[420px_minmax(0,1fr)] overflow-hidden rounded-4 border border-line bg-bg shadow-1">
      {/* List pane */}
      <div className="flex min-h-0 flex-col overflow-hidden border-r border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line bg-bg-2 px-3.5 py-3">
          <h2 className="font-serif text-[20px] font-medium tracking-tight">{title}</h2>
          <span className="rounded border border-line bg-surface px-1.5 py-px font-mono text-[11px] text-ink-3">
            {totalCount}
          </span>
        </div>

        {topBanner}

        <div className="flex overflow-x-auto border-b border-line bg-surface px-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-[12px] font-medium",
                t.key === activeTab
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={cn(
                    "rounded px-1 font-mono text-[10px]",
                    t.key === activeTab ? "bg-accent-bg text-accent" : "bg-bg-3 text-ink-3",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {(filters?.length || onQueryChange) && (
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap border-b border-line bg-bg px-3 py-2">
            {filters?.map((f) => {
              const on = activeFilters?.includes(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => onFilterToggle?.(f.key)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink-3 hover:border-line-3",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
            {onQueryChange && (
              <input
                value={query ?? ""}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="search…"
                className="ml-auto w-32 rounded-2 border border-line bg-surface px-2 py-0.5 text-[11.5px] outline-none focus:border-accent"
              />
            )}
          </div>
        )}

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {buckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="sticky top-0 z-[1] flex items-center gap-1.5 border-b border-line bg-bg-2 px-3.5 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                {bucket.label}
                <span className="text-ink-4">{bucket.rows.length}</span>
              </div>
              {bucket.rows.length === 0 ? (
                <div className="px-3.5 py-2 text-[11.5px] italic text-ink-4">none</div>
              ) : (
                bucket.rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => onSelectionChange(row.id)}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-line px-3.5 py-2 text-left text-[12.5px]",
                      row.id === selectedId
                        ? "border-l-[3px] border-l-accent bg-accent-bg pl-[11px]"
                        : "hover:bg-bg-2",
                      row.late && "bg-tone-red-bg/30",
                    )}
                  >
                    {row.render}
                  </button>
                ))
              )}
            </div>
          ))}
          {flatRows.length === 0 && (
            <div className="p-6 text-center text-[12.5px] text-ink-3">
              No rows match the current filter.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-line bg-bg-2 px-3.5 py-2 text-[11px] text-ink-3">
          <span>
            {flatRows.length} of {totalCount}
          </span>
          <span className="flex items-center gap-2">
            <Kbd>J</Kbd>/<Kbd>K</Kbd> nav
          </span>
        </div>
      </div>

      {/* Detail pane */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        {detail ?? (
          <div className="m-auto max-w-sm p-8 text-center text-[12.5px] text-ink-3">
            Select a row to see details.
          </div>
        )}
        {shortcuts && shortcuts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3.5 border-t border-line bg-bg-2 px-5 py-1.5 text-[11px] text-ink-3">
            {shortcuts.map((s) => (
              <span key={s.key} className="flex items-center gap-1">
                <Kbd>{s.key.toUpperCase()}</Kbd>
                {s.label}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1">
              <Kbd>⌘↵</Kbd>
              done
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
