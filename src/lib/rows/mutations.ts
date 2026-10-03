"use server";

import { z } from "zod";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";
import { coerceProp, coerceProps, formatProp } from "@/lib/props";
import type { PropertyDef, RowData } from "@/lib/types";

async function tableDefs(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], tableId: string) {
  const { data } = await supabase
    .from("properties")
    .select("id, table_id, key, name, type, options, relation_table_id, show_in_list, sort_order")
    .eq("table_id", tableId);
  return ((data ?? []) as PropertyDef[]).map((d) => ({
    ...d,
    options: Array.isArray(d.options) ? d.options : [],
  }));
}

async function workspaceSlug(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workspaceId: string,
) {
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).maybeSingle();
  return data?.slug as string | undefined;
}

const CreateRow = z.object({
  workspaceId: z.string().uuid(),
  tableId: z.string().uuid(),
  title: z.string().min(1).max(300),
  refCode: z.string().max(64).optional(),
  props: z.record(z.unknown()).optional(),
});

export async function createRow(input: z.infer<typeof CreateRow>) {
  const v = CreateRow.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");

  const defs = await tableDefs(supabase, v.data.tableId);
  const props = coerceProps(defs, v.data.props ?? {});
  const refCode = v.data.refCode?.trim();
  const { data, error } = await supabase
    .from("rows")
    .insert({
      workspace_id: v.data.workspaceId,
      table_id: v.data.tableId,
      title: v.data.title.trim(),
      ref_code: refCode && refCode !== "" ? refCode : null,
      props,
    })
    .select("id, ref_code, title")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`Ref "${refCode}" is already used in this workspace.`);
    return fail(error.message);
  }
  const slug = await workspaceSlug(supabase, v.data.workspaceId);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const, data: data as { id: string; ref_code: string; title: string } };
}

const UpdateRow = z.object({
  rowId: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  refCode: z.string().min(1).max(64).optional(),
  props: z.record(z.unknown()).optional(),
});

/** Update title / ref / a subset of props (merged into the existing JSON). */
export async function updateRow(input: z.infer<typeof UpdateRow>) {
  const v = UpdateRow.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");

  const { data: row } = await supabase
    .from("rows")
    .select("id, workspace_id, table_id, props")
    .eq("id", v.data.rowId)
    .maybeSingle();
  if (!row) return fail("Row not found.");

  const patch: Record<string, unknown> = {};
  if (v.data.title !== undefined) patch.title = v.data.title.trim();
  if (v.data.refCode !== undefined) patch.ref_code = v.data.refCode.trim();
  if (v.data.props) {
    const defs = await tableDefs(supabase, row.table_id);
    const coerced = coerceProps(defs, v.data.props);
    patch.props = { ...(row.props as object), ...coerced };
  }
  const { error } = await supabase.from("rows").update(patch).eq("id", row.id);
  if (error) {
    if (error.code === "23505") return fail("That ref is already used in this workspace.");
    return fail(error.message);
  }
  const slug = await workspaceSlug(supabase, row.workspace_id);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const };
}

const SetProp = z.object({
  rowId: z.string().uuid(),
  key: z.string().min(1).max(40),
  value: z.unknown(),
  /** write a `gate` diary entry recording the change (used by board drags) */
  logGate: z.boolean().optional(),
});

/** Set one property. With `logGate`, also records "Moved #REF → value" in the diary. */
export async function setRowProp(input: z.infer<typeof SetProp>) {
  const v = SetProp.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");

  const { data: row } = await supabase
    .from("rows")
    .select("id, workspace_id, table_id, ref_code, title, props")
    .eq("id", v.data.rowId)
    .maybeSingle();
  if (!row) return fail("Row not found.");
  const defs = await tableDefs(supabase, row.table_id);
  const def = defs.find((d) => d.key === v.data.key);
  if (!def) return fail("Unknown property.");

  const next = coerceProp(def.type, v.data.value, def.options);
  const prev = (row.props as RowData["props"])[def.key] ?? null;
  const props = { ...(row.props as object), [def.key]: next };
  const { error } = await supabase.from("rows").update({ props }).eq("id", row.id);
  if (error) return fail(error.message);

  if (v.data.logGate && String(prev ?? "") !== String(next ?? "")) {
    const from = formatProp(def, prev) || "none";
    const to = formatProp(def, next) || "none";
    const projectId = typeof props["project"] === "string" ? (props["project"] as string) : null;
    const { data: entry } = await supabase
      .from("entries")
      .insert({
        workspace_id: row.workspace_id,
        author_id: user.id,
        type: "gate",
        body_md: `Moved #${row.ref_code} → ${to} (${def.name}, from ${from})`,
        project_row_id: projectId,
      })
      .select("id")
      .single();
    if (entry) await supabase.from("entry_refs").insert({ entry_id: entry.id, row_id: row.id });
  }

  const slug = await workspaceSlug(supabase, row.workspace_id);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const };
}

export async function archiveRow(input: { rowId: string; archived: boolean }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: row } = await supabase
    .from("rows")
    .select("id, workspace_id")
    .eq("id", input.rowId)
    .maybeSingle();
  if (!row) return fail("Row not found.");
  const { error } = await supabase
    .from("rows")
    .update({ archived_at: input.archived ? new Date().toISOString() : null })
    .eq("id", row.id);
  if (error) return fail(error.message);
  const slug = await workspaceSlug(supabase, row.workspace_id);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const };
}
