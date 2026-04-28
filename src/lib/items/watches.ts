"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function toggleWatch(input: { itemId: string; projectCode: string }) {
  const Schema = z.object({
    itemId: z.string().uuid(),
    projectCode: z.string().min(1),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("watches")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("ref_kind", "item")
    .eq("ref_id", v.data.itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("watches")
      .delete()
      .eq("user_id", user.id)
      .eq("ref_kind", "item")
      .eq("ref_id", v.data.itemId);
    if (error) return { ok: false as const, error: error.message };
    revalidatePath(`/p/${v.data.projectCode}/watching`);
    return { ok: true as const, watching: false };
  }

  const { error } = await supabase.from("watches").insert({
    user_id: user.id,
    ref_kind: "item",
    ref_id: v.data.itemId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/p/${v.data.projectCode}/watching`);
  return { ok: true as const, watching: true };
}
