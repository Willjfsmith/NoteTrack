import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EntryRowData } from "./types";

/**
 * Fetch a recent slice of entries for a project, ordered newest-first. The
 * type key/label/colour are pulled from the joined `entry_types` row; the
 * type-specific shape (risks, decisions, gates) lives in `entries.props`.
 *
 * The thin `actions` table is still joined for the assigned/due query
 * patterns the action register depends on.
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
      id, body_md, occurred_at, author_id, source_meeting_id, props,
      entry_type:entry_type_id ( key, name, color ),
      actions:actions!actions_entry_id_fkey ( status, due_at, owner_person_id )
    `,
    )
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.meetingId) q = q.eq("source_meeting_id", opts.meetingId);
  if (opts.sinceIso) q = q.gt("occurred_at", opts.sinceIso);

  const { data, error } = await q;
  if (error || !data) return [];

  type EntryTypeJoin = { key: string; name: string; color: string | null };
  type ActionJoin = { status: string; due_at: string | null; owner_person_id: string | null };
  const rows = data as Array<{
    id: string;
    body_md: string;
    occurred_at: string;
    author_id: string | null;
    props: Record<string, unknown> | null;
    entry_type: EntryTypeJoin | EntryTypeJoin[] | null;
    actions: ActionJoin[] | null;
  }>;

  return rows.map((r) => {
    const et = Array.isArray(r.entry_type) ? r.entry_type[0] : r.entry_type;
    const typeKey = et?.key ?? "note";
    const props = r.props ?? {};
    return {
      id: r.id,
      type: typeKey,
      type_label: et?.name ?? null,
      type_color: et?.color ?? null,
      body_md: r.body_md,
      occurred_at: r.occurred_at,
      props,
      action: r.actions?.[0]
        ? { status: r.actions[0].status, due_at: r.actions[0].due_at }
        : null,
      risk:
        typeKey === "risk" && typeof props.probability === "number" && typeof props.impact === "number"
          ? {
              probability: props.probability as number,
              impact: props.impact as number,
              status: (props.status as string) ?? "open",
            }
          : null,
      decision:
        typeKey === "decision"
          ? { status: (props.status as string) ?? "proposed" }
          : null,
      gate:
        typeKey === "gate"
          ? {
              from_stage: (props.from_stage_id as string | undefined) ?? null,
              to_stage: (props.to_stage_id as string | undefined) ?? null,
              ref_code: null,
            }
          : null,
    };
  });
}
