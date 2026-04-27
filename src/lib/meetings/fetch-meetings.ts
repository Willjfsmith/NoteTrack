import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MeetingRow, MeetingChildEntry } from "./types";

type RawMeeting = {
  entry_id: string;
  series: string | null;
  location: string | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  entry: { body_md: string; occurred_at: string; project_id: string } | { body_md: string; occurred_at: string; project_id: string }[] | null;
  attendees: Array<{ person: { id: string; name: string; initials: string; color: string | null } | { id: string; name: string; initials: string; color: string | null }[] | null }> | null;
};

export async function fetchMeetings(projectId: string): Promise<MeetingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("meetings")
    .select(
      `
      entry_id, series, location, started_at, ended_at, recording_url,
      entry:entry_id!inner ( body_md, occurred_at, project_id ),
      attendees:meeting_attendees (
        person:person_id ( id, name, initials, color )
      )
    `,
    )
    .eq("entry.project_id", projectId)
    .order("started_at", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as unknown as RawMeeting[];
  return rows.map((r) => {
    const entry = Array.isArray(r.entry) ? r.entry[0] : r.entry;
    return {
      entry_id: r.entry_id,
      body_md: entry?.body_md ?? "",
      occurred_at: entry?.occurred_at ?? "",
      series: r.series,
      location: r.location,
      started_at: r.started_at,
      ended_at: r.ended_at,
      recording_url: r.recording_url,
      attendees:
        (r.attendees ?? []).map((a) => {
          const p = Array.isArray(a.person) ? a.person[0] : a.person;
          return p ? { id: p.id, name: p.name, initials: p.initials, color: p.color } : null;
        }).filter(Boolean) as MeetingRow["attendees"],
    };
  });
}

export async function fetchMeetingChildren(meetingId: string): Promise<MeetingChildEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entries")
    .select("id, type, body_md, occurred_at")
    .eq("source_meeting_id", meetingId)
    .order("occurred_at", { ascending: true });
  return (data ?? []) as MeetingChildEntry[];
}
