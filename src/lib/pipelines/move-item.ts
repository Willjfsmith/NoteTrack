"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  itemId: z.string().uuid(),
  toStageId: z.string().uuid(),
});

/**
 * Move an item to a new stage. Logs the move as a gate-typed entry whose
 * props record `{item_id, from_stage_id, to_stage_id}`; the specialised
 * `gate_moves` table was retired in 0005_schema_engine.sql. The accompanying
 * entry_ref keeps `#ref` clicks routing to the item.
 */
export async function moveItem(input: { itemId: string; toStageId: string }) {
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  // Read the item and its project, plus current stage for the gate row.
  const { data: item } = await supabase
    .from("items")
    .select("id, project_id, ref_code, title, current_stage_id")
    .eq("id", v.data.itemId)
    .maybeSingle();
  if (!item) return { ok: false as const, error: "Item not found." };

  if (item.current_stage_id === v.data.toStageId) {
    return { ok: true as const, noop: true };
  }

  const { data: toStage } = await supabase
    .from("pipeline_stages")
    .select("id, name, pipeline_id")
    .eq("id", v.data.toStageId)
    .maybeSingle();
  if (!toStage) return { ok: false as const, error: "Target stage not found." };

  let fromStageName: string | null = null;
  if (item.current_stage_id) {
    const { data: fromStage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("id", item.current_stage_id)
      .maybeSingle();
    fromStageName = fromStage?.name ?? null;
  }

  // Locate the project's gate entry-type via the system flag.
  const { data: gateType } = await supabase
    .from("entry_types")
    .select("id")
    .eq("project_id", item.project_id)
    .eq("is_system_gate", true)
    .maybeSingle();
  if (!gateType) {
    return { ok: false as const, error: "Project has no gate entry type configured." };
  }

  // 1. Create the gate-typed entry with the move recorded in props.
  const body = `Moved #${item.ref_code} → ${toStage.name}` +
    (fromStageName ? ` (from ${fromStageName})` : "");
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      project_id: item.project_id,
      author_id: user.id,
      entry_type_id: gateType.id,
      body_md: body,
      props: {
        item_id: item.id,
        from_stage_id: item.current_stage_id,
        to_stage_id: v.data.toStageId,
      },
    })
    .select("id")
    .single();
  if (entryErr || !entry) return { ok: false as const, error: entryErr?.message ?? "Failed to log gate." };

  // 2. Add an entry_ref so #ref-clicks from the diary route to the item.
  await supabase.from("entry_refs").upsert(
    { entry_id: entry.id, ref_kind: "item" as const, ref_id: item.id },
    { onConflict: "entry_id,ref_kind,ref_id", ignoreDuplicates: true },
  );

  // 3. Update the item's current stage.
  const { error: itemErr } = await supabase
    .from("items")
    .update({ current_stage_id: v.data.toStageId })
    .eq("id", item.id);
  if (itemErr) return { ok: false as const, error: itemErr.message };

  // Touch related pages.
  const { data: project } = await supabase
    .from("projects")
    .select("code")
    .eq("id", item.project_id)
    .single();
  if (project?.code) {
    revalidatePath(`/p/${project.code}/pipelines`);
    revalidatePath(`/p/${project.code}/today`);
  }

  return { ok: true as const, noop: false };
}
