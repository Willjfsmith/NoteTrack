"use server";

import { z } from "zod";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";

const Record_ = z.object({
  workspaceId: z.string().uuid(),
  /** attach to an existing entry; otherwise a `note` entry is created */
  entryId: z.string().uuid().optional(),
  kind: z.enum(["file", "ink"]),
  filePath: z.string().min(1).max(500),
  mime: z.string().max(120).nullable(),
  bytes: z.number().int().min(0),
  meta: z.record(z.unknown()).optional(),
  /** body for the new note entry when entryId is not given */
  body: z.string().max(2000).optional(),
  linkRowIds: z.array(z.string().uuid()).optional(),
  projectRowId: z.string().uuid().optional(),
  meetingRowId: z.string().uuid().optional(),
});

/** Record an attachment row after the client uploaded the file to Storage. */
export async function recordAttachment(input: z.infer<typeof Record_>) {
  const v = Record_.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");

  let entryId = v.data.entryId ?? null;
  if (!entryId) {
    const name = v.data.filePath.slice(v.data.filePath.lastIndexOf("/") + 1);
    const { data: entry, error } = await supabase
      .from("entries")
      .insert({
        workspace_id: v.data.workspaceId,
        author_id: user.id,
        type: "note",
        body_md: v.data.body?.trim() || (v.data.kind === "ink" ? "Sketch" : `Attached ${name}`),
        project_row_id: v.data.projectRowId ?? null,
        meeting_row_id: v.data.meetingRowId ?? null,
      })
      .select("id")
      .single();
    if (error || !entry) return fail(error?.message ?? "Failed to create entry.");
    entryId = entry.id;
    if (v.data.linkRowIds?.length) {
      await supabase
        .from("entry_refs")
        .insert(v.data.linkRowIds.map((row_id) => ({ entry_id: entryId, row_id })));
    }
  }

  const { error: attErr } = await supabase.from("attachments").insert({
    workspace_id: v.data.workspaceId,
    entry_id: entryId,
    kind: v.data.kind,
    file_path: v.data.filePath,
    mime: v.data.mime,
    bytes: v.data.bytes,
    meta: v.data.meta ?? {},
  });
  if (attErr) return fail(attErr.message);

  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", v.data.workspaceId).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return { ok: true as const, data: { entryId } };
}
