import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RiskRow } from "./types";

type RawRisk = {
  entry_id: string;
  probability: number;
  impact: number;
  status: RiskRow["status"];
  owner: RiskRow["owner"] | RiskRow["owner"][] | null;
  entry: { body_md: string; occurred_at: string; project_id: string } | { body_md: string; occurred_at: string; project_id: string }[] | null;
};

export async function fetchRisks(projectId: string): Promise<RiskRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("risks")
    .select(
      `
      entry_id, probability, impact, status,
      owner:owner_person_id ( id, short_id, name, initials, color ),
      entry:entry_id!inner ( body_md, occurred_at, project_id )
    `,
    )
    .eq("entry.project_id", projectId)
    .order("probability", { ascending: false })
    .limit(500);

  if (error || !data) return [];
  const rows = data as unknown as RawRisk[];

  // Resolve first linked item ref per entry, like in actions.
  const entryIds = rows.map((r) => r.entry_id);
  const refsByEntry: Record<string, string> = {};
  if (entryIds.length > 0) {
    const { data: refs } = await supabase
      .from("entry_refs")
      .select("entry_id, items:ref_id ( ref_code )")
      .eq("ref_kind", "item")
      .in("entry_id", entryIds);
    for (const ref of (refs ?? []) as Array<{
      entry_id: string;
      items: { ref_code: string } | { ref_code: string }[] | null;
    }>) {
      if (refsByEntry[ref.entry_id]) continue;
      const code = Array.isArray(ref.items) ? ref.items[0]?.ref_code : ref.items?.ref_code;
      if (code) refsByEntry[ref.entry_id] = code;
    }
  }

  return rows.map((r) => {
    const entry = Array.isArray(r.entry) ? r.entry[0] : r.entry;
    const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
    return {
      entry_id: r.entry_id,
      body_md: entry?.body_md ?? "",
      occurred_at: entry?.occurred_at ?? "",
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      owner: owner ?? null,
      source_item_ref: refsByEntry[r.entry_id] ?? null,
    };
  });
}
