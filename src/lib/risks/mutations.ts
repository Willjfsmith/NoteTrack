"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  entryId: z.string().uuid(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(["open", "mitigating", "closed"]).optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
});

export async function updateRisk(input: z.infer<typeof Schema>) {
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (v.data.probability != null) update.probability = v.data.probability;
  if (v.data.impact != null) update.impact = v.data.impact;
  if (v.data.status) update.status = v.data.status;
  if (v.data.ownerPersonId !== undefined) update.owner_person_id = v.data.ownerPersonId;
  if (Object.keys(update).length === 0) return { ok: true as const };

  const { error } = await supabase
    .from("risks")
    .update(update)
    .eq("entry_id", v.data.entryId);
  if (error) return { ok: false as const, error: error.message };

  // Touch the project's risk pages.
  const { data } = await supabase
    .from("entries")
    .select("projects:project_id ( code )")
    .eq("id", v.data.entryId)
    .maybeSingle();
  const code = (data as { projects: { code: string } | { code: string }[] | null } | null)?.projects;
  const codeStr = code ? (Array.isArray(code) ? code[0]?.code : code.code) : null;
  if (codeStr) {
    revalidatePath(`/p/${codeStr}/risks`);
    revalidatePath(`/p/${codeStr}/today`);
  }

  return { ok: true as const };
}
