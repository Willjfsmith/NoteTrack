export type MeetingRow = {
  entry_id: string;
  body_md: string;
  occurred_at: string;
  series: string | null;
  location: string | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  attendees: Array<{ id: string; name: string; initials: string; color: string | null }>;
};

export type MeetingChildEntry = {
  id: string;
  /** Entry-type key (project-defined). */
  type: string;
  body_md: string;
  occurred_at: string;
};
