"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const sample = formData.get("sample") === "on";
  if (!name) return fail("Name is required.");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data, error } = await supabase
    .rpc("create_workspace", { p_name: name, p_slug: slug || null, p_sample: sample })
    .single<{ slug: string }>();
  if (error) {
    if (error.code === "23505") return fail("That URL name is already taken.");
    return fail(error.message);
  }
  redirect(`/w/${data!.slug}/diary`);
}

const AddMember = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["owner", "editor", "viewer"]),
});

/** Adds someone who has already signed in once. Nothing is emailed. */
export async function addMemberByEmail(input: z.infer<typeof AddMember>) {
  const v = AddMember.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { error } = await supabase.rpc("add_member_by_email", {
    p_ws: v.data.workspaceId,
    p_email: v.data.email,
    p_role: v.data.role,
  });
  if (error) return fail(error.message);
  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", v.data.workspaceId).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return { ok: true as const };
}

export async function removeMember(input: { workspaceId: string; userId: string }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  if (input.userId === user.id) return fail("You cannot remove yourself.");
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);
  if (error) return fail(error.message);
  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", input.workspaceId).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return { ok: true as const };
}
