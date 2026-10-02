"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProp } from "@/lib/props";
import type { PropValue, PropertyDef, RowLookup } from "@/lib/types";
import type { PickerOptions } from "@/lib/rows/pickers";

export type { PickerOptions } from "@/lib/rows/pickers";

/**
 * Display + inline editor for one property value. Native controls on purpose:
 * they work with a mouse, a finger and a Pencil without any extra code.
 */
export function PropCell({
  def,
  value,
  lookup,
  pickers,
  slug,
  onChange,
  editable = true,
  className,
  placeholder = "—",
  dueTone = false,
}: {
  def: PropertyDef;
  value: PropValue;
  lookup: RowLookup;
  pickers: PickerOptions;
  slug: string;
  onChange: (v: PropValue) => void;
  editable?: boolean;
  className?: string;
  placeholder?: string;
  /** colour a date red when past and amber when today (for open items' due dates) */
  dueTone?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(toDraft(value));
  const ref = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(toDraft(value));
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  // a value set a moment ago may not be in the server lookup yet; the picker options know it
  const resolved =
    (def.type === "person" || def.type === "relation") && typeof value === "string" && !lookup[value]
      ? { ...lookup, ...Object.fromEntries((pickers[def.key] ?? []).map((r) => [r.id, r])) }
      : lookup;
  const display = formatProp(def, value, resolved);

  // Controls that commit immediately and never need an "editing" state.
  if (def.type === "checkbox") {
    return (
      <label className={cn("inline-flex cursor-pointer items-center", className)}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={!editable}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-ink"
        />
      </label>
    );
  }

  if (!editing) {
    const inner =
      (def.type === "person" || def.type === "relation") && typeof value === "string" && resolved[value] ? (
        <Link
          href={`/w/${slug}/r/${encodeURIComponent(resolved[value].ref_code)}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-ink hover:text-accent hover:underline"
        >
          {resolved[value].title}
        </Link>
      ) : def.type === "url" && typeof value === "string" && value ? (
        <a href={value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="truncate text-accent hover:underline">
          {value.replace(/^https?:\/\//, "")}
        </a>
      ) : def.type === "date" && typeof value === "string" && value ? (
        <span className={cn("font-mono text-[12px]", dueTone && dateTone(value))}>{formatDate(value)}</span>
      ) : def.type === "select" && display ? (
        <span className="chip font-sans normal-case">{display}</span>
      ) : def.type === "multi_select" && Array.isArray(value) ? (
        <span className="flex flex-wrap gap-0.5">
          {value.map((v) => (
            <span key={v} className="chip font-sans normal-case">{v}</span>
          ))}
        </span>
      ) : (
        <span className={cn("truncate", !display && "text-ink-4")}>{display || placeholder}</span>
      );
    return (
      <div
        onClick={() => editable && setEditing(true)}
        className={cn("flex min-h-[22px] min-w-0 items-center text-[12.5px]", editable && "cursor-text rounded-1 hover:bg-bg-2", className)}
        title={display}
      >
        {inner}
      </div>
    );
  }

  function commit(raw: string | string[]) {
    setEditing(false);
    onChange(raw === "" ? null : (raw as PropValue));
  }

  switch (def.type) {
    case "select":
      return (
        <select
          ref={ref as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setEditing(false)}
          className={cn("field-sm", className)}
        >
          <option value="">—</option>
          {def.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "person":
    case "relation": {
      const opts = pickers[def.key] ?? [];
      return (
        <select
          ref={ref as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setEditing(false)}
          className={cn("field-sm max-w-[220px]", className)}
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>{o.title} ({o.ref_code})</option>
          ))}
        </select>
      );
    }
    case "multi_select": {
      const current = new Set(Array.isArray(value) ? value : []);
      return (
        <div className={cn("flex flex-wrap items-center gap-1 rounded-2 border border-line bg-surface p-1", className)}>
          {def.options.map((o) => {
            const on = current.has(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  const next = new Set(current);
                  if (on) next.delete(o); else next.add(o);
                  onChange(next.size ? Array.from(next) : null);
                }}
                className={cn("chip font-sans normal-case", on && "border-ink bg-ink text-white")}
              >
                {on && <Check className="h-2.5 w-2.5" />} {o}
              </button>
            );
          })}
          <button type="button" onClick={() => setEditing(false)} className="ml-1 text-[11px] text-ink-3 hover:text-ink">done</button>
        </div>
      );
    }
    case "date":
      return (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") setEditing(false); }}
          className={cn("field-sm", className)}
        />
      );
    case "number":
      return (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") setEditing(false); }}
          className={cn("field-sm w-24", className)}
        />
      );
    default:
      return (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type={def.type === "url" ? "url" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") setEditing(false); }}
          className={cn("field-sm w-full", className)}
        />
      );
  }
}

function toDraft(v: PropValue): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

function dateTone(iso: string): string {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (iso < t) return "text-tone-red-ink";
  if (iso === t) return "text-tone-amber-ink";
  return "";
}
