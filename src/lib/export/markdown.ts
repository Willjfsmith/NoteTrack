/**
 * Markdown export — pure functions. The diary for a date range, or one row with its timeline.
 */
import { formatProp } from "@/lib/props";
import type { EntryData, PropertyDef, RowData, RowLookup } from "@/lib/types";

type EntryLike = Pick<EntryData, "type" | "body_md" | "occurred_at" | "struck_at" | "edited_at"> & {
  linked?: EntryData["linked"];
};

function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Group entries by local day; oldest day first, oldest entry first within a day. */
export function diaryToMarkdown(opts: {
  title: string;
  subtitle?: string;
  entries: EntryLike[];
}): string {
  const lines: string[] = [`# ${opts.title}`, ""];
  if (opts.subtitle) lines.push(`_${opts.subtitle}_`, "");
  const sorted = [...opts.entries].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  let day = "";
  for (const e of sorted) {
    const d = e.occurred_at.slice(0, 10);
    if (d !== day) {
      day = d;
      lines.push(`## ${fmtDate(e.occurred_at)}`, "");
    }
    const tag = e.type === "note" ? "" : `**${e.type}** `;
    const body = e.struck_at ? `~~${e.body_md}~~` : e.body_md;
    const meta: string[] = [];
    if (e.linked) {
      meta.push(`#${e.linked.ref_code}`);
      const st = e.linked.props?.status;
      if (typeof st === "string") meta.push(st);
      const due = e.linked.props?.due;
      if (typeof due === "string") meta.push(`due ${due}`);
    }
    lines.push(`- ${fmtTime(e.occurred_at)} ${tag}${body}${meta.length ? `  _(${meta.join(" · ")})_` : ""}`);
  }
  if (sorted.length === 0) lines.push("_No entries._");
  lines.push("");
  return lines.join("\n");
}

export function rowToMarkdown(opts: {
  row: RowData;
  tableName: string;
  defs: PropertyDef[];
  lookup: RowLookup;
  entries: EntryLike[];
}): string {
  const { row, defs, lookup } = opts;
  const lines: string[] = [`# ${row.ref_code} — ${row.title}`, "", `_${opts.tableName}_`, ""];
  const props = defs
    .map((d) => [d.name, formatProp(d, row.props[d.key] ?? null, lookup)] as const)
    .filter(([, v]) => v !== "");
  if (props.length) {
    lines.push("| Property | Value |", "| --- | --- |");
    for (const [k, v] of props) lines.push(`| ${k} | ${v} |`);
    lines.push("");
  }
  lines.push("## Timeline", "");
  const sorted = [...opts.entries].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (const e of sorted) {
    const tag = e.type === "note" ? "" : `**${e.type}** `;
    const body = e.struck_at ? `~~${e.body_md}~~` : e.body_md;
    lines.push(`- ${fmtDate(e.occurred_at, true)} ${tag}${body}`);
  }
  if (sorted.length === 0) lines.push("_No entries._");
  lines.push("");
  return lines.join("\n");
}

/** Rows of a table as a Markdown table (one line per row, visible properties as columns). */
export function tableToMarkdown(opts: {
  tableName: string;
  rows: RowData[];
  defs: PropertyDef[];
  lookup: RowLookup;
}): string {
  const cols = opts.defs.filter((d) => d.show_in_list);
  const lines: string[] = [`# ${opts.tableName}`, ""];
  lines.push(`| Ref | Title | ${cols.map((c) => c.name).join(" | ")} |`.replace(/\|\s+\|$/, "|"));
  lines.push(`| --- | --- | ${cols.map(() => "---").join(" | ")} |`.replace(/\|\s+\|$/, "|"));
  for (const r of opts.rows) {
    const cells = cols.map((c) => formatProp(c, r.props[c.key] ?? null, opts.lookup).replace(/\|/g, "\\|"));
    lines.push(`| ${r.ref_code} | ${r.title.replace(/\|/g, "\\|")} | ${cells.join(" | ")} |`.replace(/\|\s+\|$/, "|"));
  }
  lines.push("");
  return lines.join("\n");
}
