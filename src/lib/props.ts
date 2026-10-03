/**
 * Pure helpers for typed properties: coercion, display, filtering, sorting,
 * grouping. No database access — unit-tested in props.test.ts.
 */
import type {
  Filter,
  PropValue,
  PropertyDef,
  PropertyType,
  Props,
  RowData,
  RowLookup,
  Sort,
  ViewConfig,
} from "./types";

/** Coerce a raw value (from a form or JSON) into the stored shape for a type. Returns null when empty/invalid. */
export function coerceProp(type: PropertyType, raw: unknown, options: string[] = []): PropValue {
  if (raw === undefined || raw === null) return null;
  switch (type) {
    case "text":
    case "url": {
      const s = String(raw).trim();
      return s === "" ? null : s;
    }
    case "number": {
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      const s = String(raw).trim().replace(/,/g, "");
      if (s === "") return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "select": {
      const s = String(raw).trim();
      if (s === "") return null;
      return options.length === 0 || options.includes(s) ? s : null;
    }
    case "multi_select": {
      const arr = Array.isArray(raw)
        ? raw.map(String)
        : String(raw)
            .split(",")
            .map((x) => x.trim());
      const clean = arr.filter((x) => x !== "" && (options.length === 0 || options.includes(x)));
      return clean.length ? Array.from(new Set(clean)) : null;
    }
    case "date": {
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    }
    case "person":
    case "relation": {
      const s = String(raw).trim();
      return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
    }
    case "checkbox": {
      if (typeof raw === "boolean") return raw;
      const s = String(raw).toLowerCase();
      return s === "true" || s === "1" || s === "on" || s === "yes";
    }
  }
}

/** Coerce a whole props object against a table's property definitions. Unknown keys are dropped. */
export function coerceProps(defs: PropertyDef[], raw: Record<string, unknown>): Props {
  const out: Props = {};
  for (const d of defs) {
    if (!(d.key in raw)) continue;
    out[d.key] = coerceProp(d.type, raw[d.key], d.options);
  }
  return out;
}

/** Human-readable string for a value. Person/relation resolve through the lookup. */
export function formatProp(def: PropertyDef, value: PropValue, lookup: RowLookup = {}): string {
  if (value === null || value === undefined || value === "") return "";
  switch (def.type) {
    case "checkbox":
      return value ? "Yes" : "No";
    case "multi_select":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "person":
    case "relation": {
      const r = lookup[String(value)];
      return r ? r.title : "";
    }
    case "number":
      return typeof value === "number" ? String(value) : String(value);
    default:
      return String(value);
  }
}

/** Read a filter/sort key off a row: property keys or pseudo keys. */
export function readKey(row: RowData, key: string): PropValue {
  switch (key) {
    case "title":
      return row.title;
    case "ref_code":
      return row.ref_code;
    case "created_at":
      return row.created_at;
    case "updated_at":
      return row.updated_at;
    default:
      return row.props[key] ?? null;
  }
}

function isEmpty(v: PropValue): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/** `@me` in a person filter resolves to the caller's People row id. */
export const ME = "@me";

export function matchesFilter(row: RowData, f: Filter, lookup: RowLookup = {}, meId?: string | null): boolean {
  const v = readKey(row, f.key);
  const fv = f.value === ME ? (meId ?? "\u0000none") : f.value;
  switch (f.op) {
    case "empty":
      return isEmpty(v);
    case "not_empty":
      return !isEmpty(v);
    case "eq":
      if (Array.isArray(v)) return v.includes(String(fv));
      if (typeof v === "boolean") return v === (fv === true || fv === "true");
      return String(v ?? "") === String(fv ?? "");
    case "neq":
      if (Array.isArray(v)) return !v.includes(String(fv));
      if (typeof v === "boolean") return v !== (fv === true || fv === "true");
      return String(v ?? "") !== String(fv ?? "");
    case "contains": {
      const needle = String(f.value ?? "").toLowerCase();
      if (needle === "") return true;
      const hay = Array.isArray(v)
        ? v.join(" ")
        : typeof v === "string" && lookup[v]
          ? lookup[v].title + " " + lookup[v].ref_code
          : String(v ?? "");
      return hay.toLowerCase().includes(needle);
    }
    case "gt":
      return compare(v, f.value ?? null) > 0;
    case "lt":
      return compare(v, f.value ?? null) < 0;
  }
}

/** Generic comparison: numbers numerically, strings lexically, nulls last. */
export function compare(a: PropValue | undefined, b: PropValue | undefined): number {
  const ea = isEmpty(a ?? null);
  const eb = isEmpty(b ?? null);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const sa = Array.isArray(a) ? a.join(",") : String(a);
  const sb = Array.isArray(b) ? b.join(",") : String(b);
  const na = Number(sa);
  const nb = Number(sb);
  if (sa !== "" && sb !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

/** Filter + free-text query + sort, per a view config. Pure. */
export function applyView(
  rows: RowData[],
  config: ViewConfig,
  defs: PropertyDef[],
  lookup: RowLookup = {},
  meId?: string | null,
): RowData[] {
  let out = rows;
  for (const f of config.filters ?? []) out = out.filter((r) => matchesFilter(r, f, lookup, meId));
  const q = (config.q ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      if (r.title.toLowerCase().includes(q) || r.ref_code.toLowerCase().includes(q)) return true;
      for (const d of defs) {
        const s = formatProp(d, r.props[d.key] ?? null, lookup).toLowerCase();
        if (s.includes(q)) return true;
      }
      return false;
    });
  }
  const sort: Sort | undefined = config.sort;
  if (sort) {
    const defsByKey = Object.fromEntries(defs.map((d) => [d.key, d]));
    const dir = sort.dir === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const d = defsByKey[sort.key];
      let va = readKey(a, sort.key);
      let vb = readKey(b, sort.key);
      if (d && (d.type === "person" || d.type === "relation")) {
        va = lookup[String(va)]?.title ?? null;
        vb = lookup[String(vb)]?.title ?? null;
      }
      // empties always sort last, whatever the direction
      const ea = isEmpty(va);
      const eb = isEmpty(vb);
      if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1;
      return compare(va, vb) * dir;
    });
  }
  return out;
}

/** Group rows by a select property. Returns groups in option order, then "(none)". */
export function groupRows(
  rows: RowData[],
  def: PropertyDef | undefined,
): Array<{ key: string; label: string; rows: RowData[] }> {
  if (!def) return [{ key: "", label: "All", rows }];
  const buckets = new Map<string, RowData[]>();
  for (const o of def.options) buckets.set(o, []);
  const none: RowData[] = [];
  for (const r of rows) {
    const v = r.props[def.key];
    const k = v === null || v === undefined || v === "" ? null : String(v);
    if (k === null) none.push(r);
    else {
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
  }
  const out = Array.from(buckets.entries()).map(([key, rs]) => ({ key, label: key, rows: rs }));
  out.push({ key: "", label: "(none)", rows: none });
  return out;
}

/** Collect every row id referenced by person/relation props, so callers can fetch a lookup in one query. */
export function collectRefIds(rows: RowData[], defs: PropertyDef[]): string[] {
  const ids = new Set<string>();
  const refDefs = defs.filter((d) => d.type === "person" || d.type === "relation");
  for (const r of rows) {
    for (const d of refDefs) {
      const v = r.props[d.key];
      if (typeof v === "string" && v) ids.add(v);
    }
  }
  return Array.from(ids);
}

/** A key → "Name" map for property keys plus the pseudo keys. */
export function keyLabel(defs: PropertyDef[], key: string): string {
  const d = defs.find((x) => x.key === key);
  if (d) return d.name;
  return { title: "Title", ref_code: "Ref", created_at: "Created", updated_at: "Updated" }[key] ?? key;
}

/** Turn a human name into a safe property key. */
export function slugKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Risk score helper (probability × impact), for the Risks table. */
export function riskScore(props: Props): number | null {
  const p = props.probability;
  const i = props.impact;
  if (typeof p !== "number" || typeof i !== "number") return null;
  return p * i;
}
