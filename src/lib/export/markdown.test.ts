import { describe, expect, it } from "vitest";
import { diaryToMarkdown, rowToMarkdown, tableToMarkdown } from "./markdown";
import type { PropertyDef, RowData } from "@/lib/types";

const entries = [
  { type: "note" as const, body_md: "second", occurred_at: "2026-02-02T09:00:00Z", struck_at: null, edited_at: null },
  { type: "action" as const, body_md: "first", occurred_at: "2026-02-01T09:00:00Z", struck_at: null, edited_at: null,
    linked: { id: "x", ref_code: "ACT-1", title: "first", table_id: "t", props: { status: "open", due: "2026-02-03" } } },
  { type: "note" as const, body_md: "gone", occurred_at: "2026-02-01T10:00:00Z", struck_at: "2026-02-01T11:00:00Z", edited_at: null },
];

describe("diaryToMarkdown", () => {
  it("groups by day oldest-first, tags types, strikes struck entries, shows linked row meta", () => {
    const md = diaryToMarkdown({ title: "Diary", entries });
    const lines = md.split("\n");
    expect(lines[0]).toBe("# Diary");
    const dayHeaders = lines.filter((l) => l.startsWith("## "));
    expect(dayHeaders.length).toBe(2);
    expect(md.indexOf("first")).toBeLessThan(md.indexOf("second"));
    expect(md).toContain("**action** first");
    expect(md).toContain("#ACT-1 · open · due 2026-02-03");
    expect(md).toContain("~~gone~~");
  });
  it("handles empty", () => {
    expect(diaryToMarkdown({ title: "D", entries: [] })).toContain("_No entries._");
  });
});

const defs: PropertyDef[] = [
  { id: "1", table_id: "t", key: "status", name: "Status", type: "select", options: ["open"], relation_table_id: null, show_in_list: true, sort_order: 1 },
  { id: "2", table_id: "t", key: "owner", name: "Owner", type: "person", options: [], relation_table_id: null, show_in_list: true, sort_order: 2 },
  { id: "3", table_id: "t", key: "hidden", name: "Hidden", type: "text", options: [], relation_table_id: null, show_in_list: false, sort_order: 3 },
];
const row: RowData = {
  id: "r", workspace_id: "w", table_id: "t", ref_code: "ACT-1", title: "Do | thing", props: { status: "open", owner: "p1", hidden: "h" },
  user_id: null, source_entry_id: null, archived_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const lookup = { p1: { id: "p1", ref_code: "sk", title: "Sarah K.", table_id: "people" } };

describe("rowToMarkdown", () => {
  it("renders a property table with resolved people and a timeline", () => {
    const md = rowToMarkdown({ row, tableName: "Actions", defs, lookup, entries: entries.slice(0, 1) });
    expect(md).toContain("# ACT-1 — Do | thing");
    expect(md).toContain("| Owner | Sarah K. |");
    expect(md).toContain("## Timeline");
    expect(md).toContain("second");
  });
});

describe("tableToMarkdown", () => {
  it("uses visible columns only and escapes pipes", () => {
    const md = tableToMarkdown({ tableName: "Actions", rows: [row], defs, lookup });
    expect(md).toContain("| Ref | Title | Status | Owner |");
    expect(md).not.toContain("Hidden");
    expect(md).toContain("Do \\| thing");
  });
});
