import { z } from "zod";

export const CreateEntryInput = z.object({
  projectId: z.string().uuid(),
  raw: z.string().min(1).max(5000),
  /** Optional — if set, the resulting entry is attached to a meeting via source_meeting_id. */
  meetingId: z.string().uuid().optional(),
});
export type CreateEntryInput = z.infer<typeof CreateEntryInput>;

export type CreatedEntry = {
  id: string;
  type: "note" | "action" | "decision" | "risk" | "gate" | "meeting" | "call";
  body_md: string;
  occurred_at: string;
  project_id: string;
  author_id: string | null;
  source_meeting_id: string | null;
};
