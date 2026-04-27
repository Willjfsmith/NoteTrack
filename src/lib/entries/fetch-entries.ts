import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EntryRowData } from "./types";

/**
 * Fetch a recent slice of entries for a project, ordered newest-first, joined
 * with their type-specific row. We keep this simple and rely on RLS to scope
 * results.
 */
export async function fetchEntries(
  projectId: string,
  opts: { limit?: number; meetingId?: string; sinceIso?: string } = {},
): Promise<EntryRowData[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("entries")
    .select(
      `
      id, type, body_md, occurred_at, author_id, source_meeting_id,
      author:author_id ( ),
      actions:actions!actions_entry_id_fkey ( status, due_at, owner_person_id ),
      risks:risks!risks_entry_id_fkey ( probability, impact, status ),
      decisions:decisions!decisions_entry_id_fkey ( status ),
      gate_moves:gate_moves!gate_moves_entry_id_fkey ( from_stage_id, to_stage_id, item_id )
    `,
    )
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.meetingId) q = q.eq("source_meeting_id", opts.meetingId);
  if (opts.sinceIso) q = q.gt("occurred_at", opts.sinceIso);

  const { data, error } = await q;
  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    type: EntryRowData["type"];
    body_md: string;
    occurred_at: string;
    author_id: string | null;
    actions: Array<{ status: string; due_at: string | null; owner_person_id: string | null }> | null;
    risks: Array<{ probability: number; impact: number; status: string }> | null;
    decisions: Array<{ status: string }> | null;
    gate_moves: Array<{ from_stage_id: string | null; to_stage_id: string | null; item_id: string | null }> | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body_md: r.body_md,
    occurred_at: r.occurred_at,
    action: r.actions?.[0]
      ? { status: r.actions[0].status, due_at: r.actions[0].due_at }
      : null,
    risk: r.risks?.[0]
      ? { probability: r.risks[0].probability, impact: r.risks[0].impact, status: r.risks[0].status }
      : null,
    decision: r.decisions?.[0] ? { status: r.decisions[0].status } : null,
    gate: r.gate_moves?.[0]
      ? { from_stage: null, to_stage: null, ref_code: null } // resolved in a richer query later if needed
      : null,
  }));
}
