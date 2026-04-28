export type EntryRowData = {
  id: string;
  type: "note" | "action" | "decision" | "risk" | "gate" | "meeting" | "call";
  body_md: string;
  occurred_at: string;
  author?: { name: string | null; initials: string | null; color: string | null } | null;
  /** Optional metadata for type-specific rows. */
  action?: { status: string; due_at: string | null; owner_initials?: string | null } | null;
  risk?: { probability: number; impact: number; status: string } | null;
  decision?: { status: string } | null;
  gate?: { from_stage: string | null; to_stage: string | null; ref_code: string | null } | null;
};
