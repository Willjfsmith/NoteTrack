import { differenceInDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BoardCard = {
  id: string;
  ref_code: string;
  title: string;
  /** Item-type key (resolved via the item_types join). */
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
    .select("id, applies_to_type_id")
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

  // Items are scoped to the pipeline's attached type (if any). When the
  // pipeline has no attached type, all items in the project participate —
  // matches today's single-pipeline behaviour.
  let itemsQ = supabase
    .from("items")
    .select("id, ref_code, title, current_stage_id, updated_at, item_type:type_id ( key )")
    .eq("project_id", projectId)
    .in("current_stage_id", stageIds)
    .limit(stages.length * PER_COLUMN_LIMIT);
  if (pipeline.applies_to_type_id) {
    itemsQ = itemsQ.eq("type_id", pipeline.applies_to_type_id);
  }
  const { data: items } = await itemsQ;

  // Last gate move per item — recovered from entries with the gate type
  // (props.item_id matches). The specialised `gate_moves` table is gone.
  const itemIds = (items ?? []).map((i) => i.id);
  const lastMoveByItem: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: gateType } = await supabase
      .from("entry_types")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_system_gate", true)
      .maybeSingle();
    if (gateType) {
      const { data: gates } = await supabase
        .from("entries")
        .select("occurred_at, props")
        .eq("project_id", projectId)
        .eq("entry_type_id", gateType.id)
        .order("occurred_at", { ascending: false })
        .limit(itemIds.length * 6);
      type GateRow = { occurred_at: string; props: Record<string, unknown> | null };
      for (const g of (gates ?? []) as GateRow[]) {
        const itemId = (g.props as Record<string, unknown> | null)?.item_id;
        if (typeof itemId !== "string") continue;
        if (!itemIds.includes(itemId)) continue;
        if (!lastMoveByItem[itemId] || lastMoveByItem[itemId] < g.occurred_at) {
          lastMoveByItem[itemId] = g.occurred_at;
        }
      }
    }
  }

  type ItemRow = {
    id: string;
    ref_code: string;
    title: string;
    current_stage_id: string | null;
    updated_at: string;
    item_type: { key: string } | { key: string }[] | null;
  };

  const cards: BoardCard[] = ((items ?? []) as ItemRow[]).map((it) => {
    const since = lastMoveByItem[it.id] ?? it.updated_at;
    const days = differenceInDays(new Date(), new Date(since));
    const itype = Array.isArray(it.item_type) ? it.item_type[0] : it.item_type;
    return {
      id: it.id,
      ref_code: it.ref_code,
      title: it.title,
      kind: itype?.key ?? "other",
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
