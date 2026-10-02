"use server";

import { z } from "zod";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";
import { slugKey } from "@/lib/props";
import { PROPERTY_TYPES } from "@/lib/types";

async function slugOf(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], workspaceId: string) {
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).maybeSingle();
  return data?.slug as string | undefined;
}

const CreateTable = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(60),
  prefix: z.string().min(1).max(8),
});

export async function createTable(input: z.infer<typeof CreateTable>) {
  const v = CreateTable.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const slug = v.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return fail("Name must contain letters or numbers.");
  const { data: last } = await supabase
    .from("tables")
    .select("sort_order")
    .eq("workspace_id", v.data.workspaceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("tables")
    .insert({
      workspace_id: v.data.workspaceId,
      slug,
      name: v.data.name.trim(),
      kind: "custom",
      ref_prefix: v.data.prefix.trim().toUpperCase(),
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id, slug")
    .single();
  if (error) {
    if (error.code === "23505") return fail("A table with that name already exists.");
    return fail(error.message);
  }
  const ws = await slugOf(supabase, v.data.workspaceId);
  if (ws) revalidateWorkspace(ws);
  return { ok: true as const, data: data as { id: string; slug: string } };
}

const UpdateTable = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(60).optional(),
  prefix: z.string().min(1).max(8).optional(),
  isStubTarget: z.boolean().optional(),
});

export async function updateTable(input: z.infer<typeof UpdateTable>) {
  const v = UpdateTable.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: t } = await supabase.from("tables").select("id, workspace_id").eq("id", v.data.tableId).maybeSingle();
  if (!t) return fail("Table not found.");
  if (v.data.isStubTarget) {
    await supabase.from("tables").update({ is_stub_target: false }).eq("workspace_id", t.workspace_id);
  }
  const patch: Record<string, unknown> = {};
  if (v.data.name !== undefined) patch.name = v.data.name.trim();
  if (v.data.prefix !== undefined) patch.ref_prefix = v.data.prefix.trim().toUpperCase();
  if (v.data.isStubTarget !== undefined) patch.is_stub_target = v.data.isStubTarget;
  const { error } = await supabase.from("tables").update(patch).eq("id", t.id);
  if (error) return fail(error.message);
  const ws = await slugOf(supabase, t.workspace_id);
  if (ws) revalidateWorkspace(ws);
  return { ok: true as const };
}

/** Delete a custom table and everything in it. System tables cannot be deleted. */
export async function deleteTable(input: { tableId: string }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: t } = await supabase
    .from("tables")
    .select("id, workspace_id, kind")
    .eq("id", input.tableId)
    .maybeSingle();
  if (!t) return fail("Table not found.");
  if (t.kind !== "custom") return fail("System tables cannot be deleted.");
  const { error } = await supabase.from("tables").delete().eq("id", t.id);
  if (error) return fail(error.message);
  const ws = await slugOf(supabase, t.workspace_id);
  if (ws) revalidateWorkspace(ws);
  return { ok: true as const };
}

const CreateProperty = z.object({
  tableId: z.string().uuid(),
  name: z.string().min(1).max(60),
  type: z.enum(PROPERTY_TYPES as [string, ...string[]]),
  options: z.array(z.string().min(1).max(60)).optional(),
  relationTableId: z.string().uuid().optional(),
});

export async function createProperty(input: z.infer<typeof CreateProperty>) {
  const v = CreateProperty.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const key = slugKey(v.data.name);
  if (!key) return fail("Name must contain letters or numbers.");
  const { data: t } = await supabase.from("tables").select("workspace_id").eq("id", v.data.tableId).maybeSingle();
  if (!t) return fail("Table not found.");
  const { data: last } = await supabase
    .from("properties")
    .select("sort_order")
    .eq("table_id", v.data.tableId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("properties").insert({
    table_id: v.data.tableId,
    key,
    name: v.data.name.trim(),
    type: v.data.type,
    options: v.data.options ?? [],
    relation_table_id: v.data.type === "relation" ? (v.data.relationTableId ?? null) : null,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) {
    if (error.code === "23505") return fail("A property with that key already exists.");
    return fail(error.message);
  }
  const ws = await slugOf(supabase, t.workspace_id);
  if (ws) revalidateWorkspace(ws);
  return { ok: true as const };
}

const UpdateProperty = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1).max(60).optional(),
  options: z.array(z.string().min(1).max(60)).optional(),
  showInList: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function updateProperty(input: z.infer<typeof UpdateProperty>) {
  const v = UpdateProperty.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: p } = await supabase
    .from("properties")
    .select("id, tables(workspace_id)")
    .eq("id", v.data.propertyId)
    .maybeSingle();
  if (!p) return fail("Property not found.");
  const patch: Record<string, unknown> = {};
  if (v.data.name !== undefined) patch.name = v.data.name.trim();
  if (v.data.options !== undefined) patch.options = v.data.options;
  if (v.data.showInList !== undefined) patch.show_in_list = v.data.showInList;
  if (v.data.sortOrder !== undefined) patch.sort_order = v.data.sortOrder;
  const { error } = await supabase.from("properties").update(patch).eq("id", p.id);
  if (error) return fail(error.message);
  const wsId = (p as unknown as { tables: { workspace_id: string } | null }).tables?.workspace_id;
  if (wsId) {
    const ws = await slugOf(supabase, wsId);
    if (ws) revalidateWorkspace(ws);
  }
  return { ok: true as const };
}

export async function deleteProperty(input: { propertyId: string }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: p } = await supabase
    .from("properties")
    .select("id, tables(workspace_id)")
    .eq("id", input.propertyId)
    .maybeSingle();
  if (!p) return fail("Property not found.");
  const { error } = await supabase.from("properties").delete().eq("id", p.id);
  if (error) return fail(error.message);
  const wsId = (p as unknown as { tables: { workspace_id: string } | null }).tables?.workspace_id;
  if (wsId) {
    const ws = await slugOf(supabase, wsId);
    if (ws) revalidateWorkspace(ws);
  }
  return { ok: true as const };
}
