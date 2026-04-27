"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  itemId: z.string().uuid(),
  toStageId: z.string().uuid(),
});

/**
 * Move an item to a new stage. Creates a `gate` entry that records the move
 * (so the Today diary picks it up), then a corresponding `gate_moves` row.
 *
 * The two writes are made sequentially. RLS ensures the caller is an editor on
 * the item's project; we don't enforce stage order here (the caller — kanban
 * UI — drives that), so callers may want to validate before invoking.
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

  // 1. Create the `gate` entry.
  const body = `Moved #${item.ref_code} → ${toStage.name}` +
    (fromStageName ? ` (from ${fromStageName})` : "");
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      project_id: item.project_id,
      author_id: user.id,
      type: "gate",
      body_md: body,
    })
    .select("id")
    .single();
  if (entryErr || !entry) return { ok: false as const, error: entryErr?.message ?? "Failed to log gate." };

  // 2. Insert the gate_moves row.
  const { error: gmErr } = await supabase.from("gate_moves").insert({
    entry_id: entry.id,
    item_id: item.id,
    from_stage_id: item.current_stage_id,
    to_stage_id: v.data.toStageId,
  });
  if (gmErr) return { ok: false as const, error: gmErr.message };

  // 3. Add an entry_ref so #ref-clicks from the diary route to the item.
  await supabase.from("entry_refs").upsert(
    { entry_id: entry.id, ref_kind: "item" as const, ref_id: item.id },
    { onConflict: "entry_id,ref_kind,ref_id", ignoreDuplicates: true },
  );

  // 4. Update the item's current stage.
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
