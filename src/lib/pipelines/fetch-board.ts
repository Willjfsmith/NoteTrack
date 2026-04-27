import { differenceInDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BoardCard = {
  id: string;
  ref_code: string;
  title: string;
  kind: string;
  current_stage_id: string | null;
  daysInStage: number;
  owner: { initials: string; color: string | null; name: string } | null;
  late: boolean;
};

export type BoardStage = {
  id: string;
  name: string;
  sort_order: number;
  cards: BoardCard[];
  /** Suggested WIP — currently the count itself, since we don't store a target yet. */
  count: number;
};

export type BoardData = {
  pipelineId: string | null;
  stages: BoardStage[];
};

const PER_COLUMN_LIMIT = 50;

export async function fetchBoard(projectId: string): Promise<BoardData> {
  const supabase = await createSupabaseServerClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("project_id", projectId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pipeline) return { pipelineId: null, stages: [] };

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, sort_order")
    .eq("pipeline_id", pipeline.id)
    .order("sort_order");

  if (!stages) return { pipelineId: pipeline.id, stages: [] };

  const stageIds = stages.map((s) => s.id);
  const { data: items } = await supabase
    .from("items")
    .select("id, ref_code, title, kind, current_stage_id, updated_at")
    .eq("project_id", projectId)
    .in("current_stage_id", stageIds)
    .limit(stages.length * PER_COLUMN_LIMIT);

  // Last gate_move per item — for days-in-stage.
  const { data: lastMoves } = await supabase
    .from("gate_moves")
    .select("item_id, entry:entry_id ( occurred_at )")
    .in("item_id", (items ?? []).map((i) => i.id))
    .order("item_id");

  const lastMoveByItem: Record<string, string> = {};
  for (const row of (lastMoves ?? []) as Array<{
    item_id: string;
    entry: { occurred_at: string } | { occurred_at: string }[] | null;
  }>) {
    const ts = Array.isArray(row.entry) ? row.entry[0]?.occurred_at : row.entry?.occurred_at;
    if (!ts) continue;
    if (!lastMoveByItem[row.item_id] || lastMoveByItem[row.item_id] < ts) {
      lastMoveByItem[row.item_id] = ts;
    }
  }

  const cards: BoardCard[] = (items ?? []).map((it) => {
    const since = lastMoveByItem[it.id] ?? it.updated_at;
    const days = differenceInDays(new Date(), new Date(since));
    return {
      id: it.id,
      ref_code: it.ref_code,
      title: it.title,
      kind: it.kind,
      current_stage_id: it.current_stage_id,
      daysInStage: Math.max(0, days),
      owner: null,
      late: days >= 21,
    };
  });

  const stagesOut: BoardStage[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    sort_order: s.sort_order,
    cards: cards.filter((c) => c.current_stage_id === s.id),
    count: cards.filter((c) => c.current_stage_id === s.id).length,
  }));

  return { pipelineId: pipeline.id, stages: stagesOut };
}
