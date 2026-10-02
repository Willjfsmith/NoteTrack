import { describe, expect, it } from "vitest";
import { applyView, coerceProp, coerceProps, groupRows, matchesFilter, slugKey } from "./props";
import type { PropertyDef, RowData } from "./types";

const def = (key: string, type: PropertyDef["type"], options: string[] = []): PropertyDef => ({
  id: key,
  table_id: "t",
  key,
  name: key,
  type,
  options,
  relation_table_id: null,
  show_in_list: true,
  sort_order: 0,
});

const row = (ref: string, props: RowData["props"], title = ref): RowData => ({
  id: ref,
  workspace_id: "w",
  table_id: "t",
  ref_code: ref,
  title,
  props,
  user_id: null,
  source_entry_id: null,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("coerceProp", () => {
  it("text trims and nulls empties", () => {
    expect(coerceProp("text", "  hi ")).toBe("hi");
    expect(coerceProp("text", "   ")).toBeNull();
  });
  it("number parses and rejects junk", () => {
    expect(coerceProp("number", "4")).toBe(4);
    expect(coerceProp("number", "1,200")).toBe(1200);
    expect(coerceProp("number", "abc")).toBeNull();
  });
  it("select enforces options when given", () => {
    expect(coerceProp("select", "open", ["open", "done"])).toBe("open");
    expect(coerceProp("select", "weird", ["open", "done"])).toBeNull();
    expect(coerceProp("select", "anything", [])).toBe("anything");
  });
  it("multi_select accepts csv or arrays and dedupes", () => {
    expect(coerceProp("multi_select", "a, b, a")).toEqual(["a", "b"]);
    expect(coerceProp("multi_select", ["x"])).toEqual(["x"]);
    expect(coerceProp("multi_select", "")).toBeNull();
  });
  it("date keeps ISO dates and normalises others", () => {
    expect(coerceProp("date", "2026-03-04")).toBe("2026-03-04");
    expect(coerceProp("date", "not a date")).toBeNull();
  });
  it("person / relation must be uuids", () => {
    expect(coerceProp("person", "123e4567-e89b-12d3-a456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(coerceProp("relation", "nope")).toBeNull();
  });
  it("checkbox understands form values", () => {
    expect(coerceProp("checkbox", "on")).toBe(true);
    expect(coerceProp("checkbox", false)).toBe(false);
  });
  it("coerceProps drops unknown keys", () => {
    const out = coerceProps([def("a", "text")], { a: "x", b: "y" });
    expect(out).toEqual({ a: "x" });
  });
});

describe("filters", () => {
  const r = row("ACT-1", { status: "open", tags: ["a", "b"], due: "2026-02-01", n: 3 });
  it("eq / neq on scalars and arrays", () => {
    expect(matchesFilter(r, { key: "status", op: "eq", value: "open" })).toBe(true);
    expect(matchesFilter(r, { key: "status", op: "neq", value: "open" })).toBe(false);
    expect(matchesFilter(r, { key: "tags", op: "eq", value: "b" })).toBe(true);
  });
  it("empty / not_empty", () => {
    expect(matchesFilter(r, { key: "missing", op: "empty" })).toBe(true);
    expect(matchesFilter(r, { key: "status", op: "not_empty" })).toBe(true);
  });
  it("gt / lt compare numbers and dates", () => {
    expect(matchesFilter(r, { key: "n", op: "gt", value: 2 })).toBe(true);
    expect(matchesFilter(r, { key: "due", op: "lt", value: "2026-03-01" })).toBe(true);
  });
  it("contains resolves relation titles through the lookup", () => {
    const rr = row("X", { owner: "u1" });
    const lookup = { u1: { id: "u1", ref_code: "sk", title: "Sarah K.", table_id: "p" } };
    expect(matchesFilter(rr, { key: "owner", op: "contains", value: "sarah" }, lookup)).toBe(true);
  });
});

describe("@me filter", () => {
  const rows = [row("A", { owner: "u1" }), row("B", { owner: "u2" }), row("C", {})];
  it("eq @me matches the caller's row id; nobody when signed-in user has no People row", () => {
    const f = { key: "owner", op: "eq" as const, value: "@me" };
    expect(applyView(rows, { filters: [f] }, [], {}, "u1").map((r) => r.ref_code)).toEqual(["A"]);
    expect(applyView(rows, { filters: [f] }, [], {}, null)).toEqual([]);
  });
  it("neq @me excludes the caller", () => {
    const f = { key: "owner", op: "neq" as const, value: "@me" };
    expect(applyView(rows, { filters: [f] }, [], {}, "u1").map((r) => r.ref_code)).toEqual(["B", "C"]);
  });
});

describe("applyView", () => {
  const defs = [def("status", "select", ["open", "done"]), def("due", "date"), def("owner", "person")];
  const rows = [
    row("A", { status: "open", due: "2026-02-03" }),
    row("B", { status: "done", due: "2026-01-01" }),
    row("C", { status: "open", due: null }),
    row("D", { status: "open", due: "2026-01-15" }),
  ];
  it("filters then sorts with nulls last", () => {
    const out = applyView(
      rows,
      { filters: [{ key: "status", op: "neq", value: "done" }], sort: { key: "due", dir: "asc" } },
      defs,
    );
    expect(out.map((r) => r.ref_code)).toEqual(["D", "A", "C"]);
  });
  it("free-text query matches title, ref and formatted props", () => {
    expect(applyView(rows, { q: "b" }, defs).map((r) => r.ref_code)).toEqual(["B"]);
  });
  it("sort desc", () => {
    const out = applyView(rows, { sort: { key: "due", dir: "desc" } }, defs);
    expect(out.map((r) => r.ref_code)).toEqual(["A", "D", "B", "C"]);
  });
});

describe("groupRows", () => {
  it("uses option order and appends (none)", () => {
    const d = def("stage", "select", ["Design", "Build"]);
    const g = groupRows([row("1", { stage: "Build" }), row("2", {}), row("3", { stage: "Odd" })], d);
    expect(g.map((x) => x.key)).toEqual(["Design", "Build", "Odd", ""]);
    expect(g[1].rows.length).toBe(1);
    expect(g[3].rows.length).toBe(1);
  });
});

describe("slugKey", () => {
  it("makes safe keys", () => {
    expect(slugKey("Due date!")).toBe("due_date");
  });
});
