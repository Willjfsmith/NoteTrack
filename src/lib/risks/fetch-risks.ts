import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RiskRow } from "./types";

/**
 * Fetch risks for a project. Risks live as entries with entry_type.key === "risk"
 * and props.{probability,impact,status,owner_person_id}; the specialised
 * `risks` table was retired in 0005_schema_engine.sql.
 */
export async function fetchRisks(projectId: string): Promise<RiskRow[]> {
  const supabase = await createSupabaseServerClient();

  // 1. Find the project's risk entry-type id.
  const { data: riskType } = await supabase
    .from("entry_types")
    .select("id")
    .eq("project_id", projectId)
    .eq("key", "risk")
    .maybeSingle();
  if (!riskType) return [];

  // 2. Pull the entries with that type for this project.
  const { data, error } = await supabase
    .from("entries")
    .select("id, body_md, occurred_at, props")
    .eq("project_id", projectId)
    .eq("entry_type_id", riskType.id)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];

  type Row = { id: string; body_md: string; occurred_at: string; props: Record<string, unknown> | null };
  const rows = data as Row[];

  // 3. Resolve owner people by person_id collected from props.
  const ownerIds = Array.from(
    new Set(
      rows
        .map((r) => (r.props as Record<string, unknown> | null)?.owner_person_id)
        .filter((v): v is string => typeof v === "string"),
    ),
  );
  const peopleById: Record<string, RiskRow["owner"]> = {};
  if (ownerIds.length > 0) {
    const { data: peopleRows } = await supabase
      .from("people")
      .select("id, short_id, name, initials, color")
      .in("id", ownerIds);
    for (const p of peopleRows ?? []) {
      peopleById[p.id] = {
        id: p.id,
        short_id: p.short_id,
        name: p.name,
        initials: p.initials,
        color: p.color,
      };
    }
  }

  // 4. Resolve first linked item ref per entry.
  const entryIds = rows.map((r) => r.id);
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

  return rows
    .map((r): RiskRow | null => {
      const props = r.props ?? {};
      const probability = typeof props.probability === "number" ? (props.probability as number) : null;
      const impact = typeof props.impact === "number" ? (props.impact as number) : null;
      const status = (props.status as RiskRow["status"]) ?? "open";
      if (probability == null || impact == null) return null;
      const ownerId = typeof props.owner_person_id === "string" ? (props.owner_person_id as string) : null;
      return {
        entry_id: r.id,
        body_md: r.body_md,
        occurred_at: r.occurred_at,
        probability,
        impact,
        status,
        owner: ownerId ? peopleById[ownerId] ?? null : null,
        source_item_ref: refsByEntry[r.id] ?? null,
      };
    })
    .filter((r): r is RiskRow => r != null)
    .sort((a, b) => b.probability * b.impact - a.probability * a.impact);
}
