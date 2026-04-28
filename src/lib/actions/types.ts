export type ActionStatus = "open" | "in_progress" | "done" | "snoozed" | "blocked";

export type ActionRow = {
  entry_id: string;
  body_md: string;
  occurred_at: string;
  status: ActionStatus;
  due_at: string | null;
  done_at: string | null;
  owner: { id: string; short_id: string; name: string; initials: string; color: string | null } | null;
  requester: { id: string; short_id: string; name: string; initials: string; color: string | null } | null;
  /** First linked item, if any. */
  source_item_ref: string | null;
};

export type Person = {
  id: string;
  short_id: string;
  name: string;
  initials: string;
  color: string | null;
  user_id: string | null;
};

export type Bucket = "late" | "today" | "week" | "later";
