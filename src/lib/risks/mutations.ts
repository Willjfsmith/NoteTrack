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

/**
 * Update a risk by patching `entries.props`. The risk specialised table was
 * removed in 0005_schema_engine.sql.
 */
export async function updateRisk(input: z.infer<typeof Schema>) {
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();

  // Read the current props so we can do a JSON merge.
  const { data: row } = await supabase
    .from("entries")
    .select("props, project_id, projects:project_id ( code )")
    .eq("id", v.data.entryId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Risk not found." };

  const props = (row.props as Record<string, unknown> | null) ?? {};
  if (v.data.probability != null) props.probability = v.data.probability;
  if (v.data.impact != null) props.impact = v.data.impact;
  if (v.data.status) props.status = v.data.status;
  if (v.data.ownerPersonId !== undefined) {
    if (v.data.ownerPersonId === null) delete props.owner_person_id;
    else props.owner_person_id = v.data.ownerPersonId;
  }

  const { error } = await supabase
    .from("entries")
    .update({ props })
    .eq("id", v.data.entryId);
  if (error) return { ok: false as const, error: error.message };

  const projects = (row as { projects: { code: string } | { code: string }[] | null }).projects;
  const codeStr = projects ? (Array.isArray(projects) ? projects[0]?.code : projects.code) : null;
  if (codeStr) {
    revalidatePath(`/p/${codeStr}/risks`);
    revalidatePath(`/p/${codeStr}/today`);
  }

  return { ok: true as const };
}
