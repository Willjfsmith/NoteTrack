import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectRefIds } from "@/lib/props";
import type { PropertyDef, RowData, RowLookup, RowRef } from "@/lib/types";

const ROW_COLS =
  "id, workspace_id, table_id, ref_code, title, props, user_id, source_entry_id, archived_at, created_at, updated_at";

export async function fetchRows(
  tableId: string,
  opts: { includeArchived?: boolean; limit?: number } = {},
): Promise<RowData[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("rows")
    .select(ROW_COLS)
    .eq("table_id", tableId)
    .order("updated_at", { ascending: false })
    .limit(opts.limit ?? 2000);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const { data } = await q;
  return ((data ?? []) as RowData[]).map(normaliseRow);
}

export async function fetchRowByRef(workspaceId: string, ref: string): Promise<RowData | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rows")
    .select(ROW_COLS)
    .eq("workspace_id", workspaceId)
    .eq("ref_code", ref)
    .maybeSingle();
  return data ? normaliseRow(data as RowData) : null;
}

export async function fetchRowById(id: string): Promise<RowData | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("rows").select(ROW_COLS).eq("id", id).maybeSingle();
  return data ? normaliseRow(data as RowData) : null;
}

/** id → RowRef for a set of ids (person / relation values). */
export async function fetchLookup(ids: string[]): Promise<RowLookup> {
  if (ids.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rows")
    .select("id, ref_code, title, table_id")
    .in("id", Array.from(new Set(ids)));
  const out: RowLookup = {};
  for (const r of (data ?? []) as RowRef[]) out[r.id] = r;
  return out;
}

/** Fetch rows plus the lookup for everything they reference. */
export async function fetchRowsWithLookup(tableId: string, defs: PropertyDef[]) {
  const rows = await fetchRows(tableId);
  const lookup = await fetchLookup(collectRefIds(rows, defs));
  return { rows, lookup };
}

/** All non-archived rows of a table as RowRefs (for pickers). */
export async function fetchRowRefs(tableId: string): Promise<RowRef[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rows")
    .select("id, ref_code, title, table_id")
    .eq("table_id", tableId)
    .is("archived_at", null)
    .order("title")
    .limit(2000);
  return (data ?? []) as RowRef[];
}

function normaliseRow(r: RowData): RowData {
  return { ...r, props: r.props && typeof r.props === "object" ? r.props : {} };
}
