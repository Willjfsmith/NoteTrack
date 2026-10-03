import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { RowData, TableDef } from "@/lib/types";

export type BacklinkGroup = { table: TableDef; property: TableDef["properties"][number]; rows: RowData[] };

/**
 * Rows in other tables whose person / relation property points at this row —
 * e.g. for a person: the actions they own; for a project: its items and risks.
 */
export async function fetchBacklinks(ctx: WorkspaceContext, row: RowData): Promise<BacklinkGroup[]> {
  const supabase = await createSupabaseServerClient();
  const people = ctx.tables.find((t) => t.kind === "people");
  const isPerson = people?.id === row.table_id;
  const targets: Array<{ table: TableDef; property: TableDef["properties"][number] }> = [];
  for (const t of ctx.tables) {
    for (const p of t.properties) {
      if ((p.type === "person" && isPerson) || (p.type === "relation" && p.relation_table_id === row.table_id)) {
        targets.push({ table: t, property: p });
      }
    }
  }
  const out: BacklinkGroup[] = [];
  await Promise.all(
    targets.map(async ({ table, property }) => {
      const { data } = await supabase
        .from("rows")
        .select("id, workspace_id, table_id, ref_code, title, props, user_id, source_entry_id, archived_at, created_at, updated_at")
        .eq("table_id", table.id)
        .is("archived_at", null)
        .filter(`props->>${property.key}`, "eq", row.id)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (data && data.length > 0) out.push({ table, property, rows: data as RowData[] });
    }),
  );
  // stable order: by table sort_order then property
  return out.sort((a, b) => a.table.sort_order - b.table.sort_order || a.property.sort_order - b.property.sort_order);
}
