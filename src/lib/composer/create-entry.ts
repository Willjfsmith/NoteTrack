"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseComposer } from "./parse";
import { CreateEntryInput, type CreatedEntry } from "./types";

export type CreateEntryResult =
  | { ok: true; entry: CreatedEntry }
  | { ok: false; error: string };

/**
 * Create an entry from a raw composer line.
 *
 * Steps (kept short on purpose — Postgres FKs + RLS do most of the work):
 *  1. Validate the input (zod).
 *  2. Verify the caller is an editor on the project.
 *  3. Parse the line.
 *  4. Insert the `entries` row.
 *  5. Insert the type-specific row (actions / decisions / risks / call uses note/decision shape).
 *  6. Resolve refs: stub missing items, look up people by short_id, write entry_refs.
 *  7. Touch revalidatePath for the today/diary view.
 */
export async function createEntry(input: CreateEntryInput): Promise<CreateEntryResult> {
  const parseResult = CreateEntryInput.safeParse(input);
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues.map((i) => i.message).join(", ") };
  }
  const { projectId, raw, meetingId } = parseResult.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "editor"].includes(membership.role)) {
    return { ok: false, error: "Not authorised to write to this project." };
  }

  const parsed = parseComposer(raw);

  // 1. Insert the entry row.
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      project_id: projectId,
      author_id: user.id,
      type: parsed.type,
      body_md: parsed.body,
      source_meeting_id: meetingId ?? null,
    })
    .select("id, type, body_md, occurred_at, project_id, author_id, source_meeting_id")
    .single();

  if (entryErr || !entry) {
    return { ok: false, error: entryErr?.message ?? "Failed to insert entry." };
  }

  // 2. Resolve people by short_id (lowercased, project-scoped).
  let personIdsByShort: Record<string, string> = {};
  if (parsed.refs.people.length > 0) {
    const { data: peopleRows } = await supabase
      .from("people")
      .select("id, short_id")
      .eq("project_id", projectId)
      .in("short_id", parsed.refs.people);
    for (const p of peopleRows ?? []) personIdsByShort[p.short_id] = p.id;
  }

  // 3. Resolve / stub items by ref_code (project-scoped).
  let itemIdsByRef: Record<string, string> = {};
  if (parsed.refs.items.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, ref_code")
      .eq("project_id", projectId)
      .in("ref_code", parsed.refs.items);
    for (const it of itemRows ?? []) itemIdsByRef[it.ref_code] = it.id;

    // Stub any missing items so refs always resolve.
    const missing = parsed.refs.items.filter((r) => !(r in itemIdsByRef));
    if (missing.length > 0) {
      const { data: stubs } = await supabase
        .from("items")
        .insert(
          missing.map((ref_code) => ({
            project_id: projectId,
            ref_code,
            title: ref_code,
            kind: "other" as const,
          })),
        )
        .select("id, ref_code");
      for (const s of stubs ?? []) itemIdsByRef[s.ref_code] = s.id;
    }
  }

  // 4. Insert the specialised row.
  if (parsed.type === "action") {
    const ownerId = pickOwner(parsed.refs.people, personIdsByShort);
    await supabase.from("actions").insert({
      entry_id: entry.id,
      owner_person_id: ownerId,
      requester_person_id: null,
      due_at: parsed.due ? new Date(parsed.due + "T17:00:00").toISOString() : null,
      status: parsed.doneShortcut ? "done" : "open",
      done_at: parsed.doneShortcut ? new Date().toISOString() : null,
    });
  } else if (parsed.type === "decision") {
    await supabase.from("decisions").insert({
      entry_id: entry.id,
      impact_text: null,
      status: "proposed",
    });
  } else if (parsed.type === "risk") {
    const ownerId = pickOwner(parsed.refs.people, personIdsByShort);
    await supabase.from("risks").insert({
      entry_id: entry.id,
      probability: parsed.probability ?? 3,
      impact: parsed.impact ?? 3,
      owner_person_id: ownerId,
      status: "open",
    });
  }
  // `note` and `call` only need the entries row.

  // 5. Insert entry_refs (item + person).
  const refRows = [
    ...Object.values(itemIdsByRef).map((ref_id) => ({
      entry_id: entry.id,
      ref_kind: "item" as const,
      ref_id,
    })),
    ...Object.values(personIdsByShort).map((ref_id) => ({
      entry_id: entry.id,
      ref_kind: "person" as const,
      ref_id,
    })),
  ];
  if (refRows.length > 0) {
    await supabase.from("entry_refs").upsert(refRows, {
      onConflict: "entry_id,ref_kind,ref_id",
      ignoreDuplicates: true,
    });
  }

  // Touch any page that lists entries.
  const code = await projectCode(projectId);
  if (code) {
    revalidatePath(`/p/${code}/today`);
    revalidatePath(`/p/${code}/actions`);
    revalidatePath(`/p/${code}/risks`);
    revalidatePath(`/p/${code}/meetings`);
  }

  return { ok: true, entry: entry as CreatedEntry };
}

function pickOwner(
  people: string[],
  byShort: Record<string, string>,
): string | null {
  for (const p of people) if (byShort[p]) return byShort[p];
  return null;
}

async function projectCode(projectId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("projects").select("code").eq("id", projectId).maybeSingle();
  return data?.code ?? null;
}
