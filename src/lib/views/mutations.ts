"use server";

import { z } from "zod";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";

const Config = z.object({
  filters: z
    .array(
      z.object({
        key: z.string().min(1),
        op: z.enum(["eq", "neq", "contains", "empty", "not_empty", "gt", "lt"]),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
      }),
    )
    .optional(),
  sort: z.object({ key: z.string().min(1), dir: z.enum(["asc", "desc"]) }).optional(),
  group: z.string().optional(),
  q: z.string().optional(),
});

const SaveView = z.object({
  tableId: z.string().uuid(),
  viewId: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  layout: z.enum(["list", "board"]),
  config: Config,
  pinned: z.boolean().optional(),
});

async function slugForTable(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], tableId: string) {
  const { data } = await supabase
    .from("tables")
    .select("workspaces(slug)")
    .eq("id", tableId)
    .maybeSingle();
  return (data as unknown as { workspaces: { slug: string } | null } | null)?.workspaces?.slug;
}

export async function saveView(input: z.infer<typeof SaveView>) {
  const v = SaveView.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const payload = {
    table_id: v.data.tableId,
    name: v.data.name.trim(),
    layout: v.data.layout,
    config: { ...v.data.config, q: undefined },
    ...(v.data.pinned !== undefined ? { pinned: v.data.pinned } : {}),
  };
  const res = v.data.viewId
    ? await supabase.from("views").update(payload).eq("id", v.data.viewId).select("id").single()
    : await supabase.from("views").insert(payload).select("id").single();
  if (res.error) return fail(res.error.message);
  const slug = await slugForTable(supabase, v.data.tableId);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const, data: { id: res.data.id as string } };
}

export async function deleteView(input: { viewId: string }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: view } = await supabase.from("views").select("table_id").eq("id", input.viewId).maybeSingle();
  if (!view) return fail("View not found.");
  const { error } = await supabase.from("views").delete().eq("id", input.viewId);
  if (error) return fail(error.message);
  const slug = await slugForTable(supabase, view.table_id);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const };
}

export async function pinView(input: { viewId: string; pinned: boolean }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: view } = await supabase.from("views").select("table_id").eq("id", input.viewId).maybeSingle();
  if (!view) return fail("View not found.");
  const { error } = await supabase.from("views").update({ pinned: input.pinned }).eq("id", input.viewId);
  if (error) return fail(error.message);
  const slug = await slugForTable(supabase, view.table_id);
  if (slug) revalidateWorkspace(slug);
  return { ok: true as const };
}
