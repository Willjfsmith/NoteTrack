"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateProjectResult = { ok: true; code: string } | { ok: false; error: string };

export async function createProjectAction(formData: FormData): Promise<CreateProjectResult> {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data, error } = await supabase
    .rpc("create_project", { p_name: name, p_code: code || null })
    .single<{ code: string }>();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That code is already taken." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/select-project");
  redirect(`/p/${data!.code}/today`);
}
