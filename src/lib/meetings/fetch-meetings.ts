import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MeetingRow, MeetingChildEntry } from "./types";

/**
 * Fetch meetings for a project. Meetings live as entries with the system
 * meeting entry type and props.{series,location,started_at,ended_at,recording_url,attendees[]};
 * the specialised `meetings` and `meeting_attendees` tables were retired in
 * 0005_schema_engine.sql.
 */
export async function fetchMeetings(projectId: string): Promise<MeetingRow[]> {
  const supabase = await createSupabaseServerClient();

  // Find the system meeting entry-type id (survives renames via the flag).
  const { data: meetingType } = await supabase
    .from("entry_types")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_system_meeting", true)
    .maybeSingle();
  if (!meetingType) return [];

  const { data, error } = await supabase
    .from("entries")
    .select("id, body_md, occurred_at, props")
    .eq("project_id", projectId)
    .eq("entry_type_id", meetingType.id)
    .order("occurred_at", { ascending: false });
  if (error || !data) return [];

  type Row = { id: string; body_md: string; occurred_at: string; props: Record<string, unknown> | null };
  const rows = data as Row[];

  // Resolve attendees by person_id collected from props.attendees arrays.
  const attendeeIds = new Set<string>();
  for (const r of rows) {
    const a = (r.props as Record<string, unknown> | null)?.attendees;
    if (Array.isArray(a)) for (const id of a) if (typeof id === "string") attendeeIds.add(id);
  }
  const peopleById: Record<string, MeetingRow["attendees"][number]> = {};
  if (attendeeIds.size > 0) {
    const { data: peopleRows } = await supabase
      .from("people")
      .select("id, name, initials, color")
      .in("id", Array.from(attendeeIds));
    for (const p of peopleRows ?? []) {
      peopleById[p.id] = { id: p.id, name: p.name, initials: p.initials, color: p.color };
    }
  }

  return rows.map((r): MeetingRow => {
    const props = r.props ?? {};
    const att = Array.isArray(props.attendees) ? (props.attendees as unknown[]) : [];
    const attendees = att
      .map((id) => (typeof id === "string" ? peopleById[id] : null))
      .filter((p): p is MeetingRow["attendees"][number] => p != null);
    return {
      entry_id: r.id,
      body_md: r.body_md,
      occurred_at: r.occurred_at,
      series: (props.series as string | undefined) ?? null,
      location: (props.location as string | undefined) ?? null,
      started_at: (props.started_at as string | undefined) ?? null,
      ended_at: (props.ended_at as string | undefined) ?? null,
      recording_url: (props.recording_url as string | undefined) ?? null,
      attendees,
    };
  });
}

export async function fetchMeetingChildren(meetingId: string): Promise<MeetingChildEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entries")
    .select("id, body_md, occurred_at, entry_type:entry_type_id ( key )")
    .eq("source_meeting_id", meetingId)
    .order("occurred_at", { ascending: true });
  type Row = {
    id: string;
    body_md: string;
    occurred_at: string;
    entry_type: { key: string } | { key: string }[] | null;
  };
  return ((data ?? []) as Row[]).map((r) => {
    const et = Array.isArray(r.entry_type) ? r.entry_type[0] : r.entry_type;
    return {
      id: r.id,
      type: et?.key ?? "note",
      body_md: r.body_md,
      occurred_at: r.occurred_at,
    };
  });
}
