"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  projectId: z.string().uuid(),
  filePath: z.string().min(1).max(500),
  mime: z.string().max(120).nullable(),
  bytes: z.number().int().min(0),
  itemRef: z.string().max(64).optional(),
  description: z.string().max(500).optional(),
});

/**
 * Record an attachment after the client uploaded the file to Supabase Storage.
 * Optionally creates a `note` entry pinned to the linked item so the upload
 * shows up in the diary.
 */
export async function recordAttachment(input: z.infer<typeof Schema>) {
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  // Resolve item if a ref was supplied.
  let itemId: string | null = null;
  if (v.data.itemRef) {
    const { data: item } = await supabase
      .from("items")
      .select("id")
      .eq("project_id", v.data.projectId)
      .eq("ref_code", v.data.itemRef)
      .maybeSingle();
    itemId = item?.id ?? null;
  }

  // Create the entry first (so we have an id for entry_refs/attachments).
  const body = v.data.description
    ? `Uploaded ${baseName(v.data.filePath)} — ${v.data.description}` +
      (v.data.itemRef ? ` #${v.data.itemRef}` : "")
    : `Uploaded ${baseName(v.data.filePath)}` + (v.data.itemRef ? ` #${v.data.itemRef}` : "");

  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      project_id: v.data.projectId,
      author_id: user.id,
      type: "note",
      body_md: body,
    })
    .select("id")
    .single();
  if (entryErr || !entry) return { ok: false as const, error: entryErr?.message ?? "Failed." };

  // Insert the attachment row.
  const { error: attErr } = await supabase.from("attachments").insert({
    entry_id: entry.id,
    project_id: v.data.projectId,
    file_path: v.data.filePath,
    mime: v.data.mime,
    bytes: v.data.bytes,
  });
  if (attErr) return { ok: false as const, error: attErr.message };

  // Link to item if present.
  if (itemId) {
    await supabase.from("entry_refs").upsert(
      { entry_id: entry.id, ref_kind: "item" as const, ref_id: itemId },
      { onConflict: "entry_id,ref_kind,ref_id", ignoreDuplicates: true },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("code")
    .eq("id", v.data.projectId)
    .maybeSingle();
  if (project?.code) {
    revalidatePath(`/p/${project.code}/library`);
    revalidatePath(`/p/${project.code}/today`);
  }

  return { ok: true as const, entryId: entry.id };
}

function baseName(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? p : p.slice(idx + 1);
}
