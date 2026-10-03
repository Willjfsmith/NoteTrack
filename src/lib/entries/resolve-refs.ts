import type { SupabaseClient } from "@supabase/supabase-js";
import type { RowRef } from "@/lib/types";

/**
 * Resolve `#ref` and `@id` tokens to rows inside a workspace.
 *  - `@id` matches People rows by ref_code (case-insensitive); `@me` is the caller's People row.
 *  - `#REF` matches any non-People row by exact ref_code; unknown refs are stubbed into the
 *    workspace's stub-target table (default: Items) so links always resolve.
 */
export async function resolveRefs(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  refs: { items: string[]; people: string[] },
): Promise<{ rows: RowRef[]; people: RowRef[]; me: RowRef | null }> {
  const { data: tables } = await supabase
    .from("tables")
    .select("id, kind, is_stub_target")
    .eq("workspace_id", workspaceId);
  const peopleTable = (tables ?? []).find((t) => t.kind === "people");
  const stubTable = (tables ?? []).find((t) => t.is_stub_target) ?? (tables ?? []).find((t) => t.kind === "custom");

  // me
  let me: RowRef | null = null;
  if (peopleTable) {
    const { data } = await supabase
      .from("rows")
      .select("id, ref_code, title, table_id")
      .eq("table_id", peopleTable.id)
      .eq("user_id", userId)
      .maybeSingle();
    me = (data as RowRef | null) ?? null;
  }

  // people
  const people: RowRef[] = [];
  const wanted = refs.people.map((p) => p.toLowerCase()).filter((p) => p !== "me");
  if (peopleTable && wanted.length > 0) {
    const { data } = await supabase
      .from("rows")
      .select("id, ref_code, title, table_id")
      .eq("table_id", peopleTable.id)
      .is("archived_at", null)
      .in("ref_code", wanted);
    for (const r of (data ?? []) as RowRef[]) people.push(r);
  }
  if (refs.people.some((p) => p.toLowerCase() === "me") && me) people.push(me);

  // rows (#refs)
  const rows: RowRef[] = [];
  if (refs.items.length > 0) {
    const { data } = await supabase
      .from("rows")
      .select("id, ref_code, title, table_id")
      .eq("workspace_id", workspaceId)
      .in("ref_code", refs.items);
    const found = ((data ?? []) as RowRef[]).filter((r) => r.table_id !== peopleTable?.id);
    rows.push(...found);
    const missing = refs.items.filter((code) => !found.some((r) => r.ref_code === code));
    if (missing.length > 0 && stubTable) {
      const { data: stubs } = await supabase
        .from("rows")
        .insert(
          missing.map((ref_code) => ({
            workspace_id: workspaceId,
            table_id: stubTable.id,
            ref_code,
            title: ref_code,
            props: {},
          })),
        )
        .select("id, ref_code, title, table_id");
      rows.push(...((stubs ?? []) as RowRef[]));
    }
  }
  return { rows, people, me };
}
