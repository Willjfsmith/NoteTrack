"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseComposer, buildSlashMap } from "./parse";
import { CreateEntryInput, type CreatedEntry } from "./types";

export type CreateEntryResult =
  | { ok: true; entry: CreatedEntry }
  | { ok: false; error: string };

/**
 * Create an entry from a raw composer line.
 *
 * Goes through the schema engine: looks up the project's entry_types, parses
 * the line with the project-specific slash map, writes `entries.entry_type_id
 * + props`, and uses the system flags on `entry_types` to decide whether to
 * additionally insert into the thin `actions` table.
 *
 * Risks/decisions/calls/notes don't get specialised tables anymore — their
 * shape lives in `entries.props`.
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

  // Load entry_types for this project so the parser can resolve slash aliases
  // and we can map type-key → entry_type_id.
  const { data: entryTypeRows } = await supabase
    .from("entry_types")
    .select("id, key, slash_aliases, is_system_action")
    .eq("project_id", projectId);

  if (!entryTypeRows || entryTypeRows.length === 0) {
    return { ok: false, error: "Project has no entry types configured." };
  }

  const { map: slashMap } = buildSlashMap(entryTypeRows);
  const entryTypeByKey = new Map<string, { id: string; is_system_action: boolean | null }>();
  for (const t of entryTypeRows) {
    entryTypeByKey.set(t.key, { id: t.id, is_system_action: t.is_system_action });
  }

  const parsed = parseComposer(raw, { slashMap });

  // Resolve the entry_type_id. If the parser fell back to "note" but the
  // project doesn't have a "note" type, use the first available type.
  const resolvedType = entryTypeByKey.get(parsed.type) ?? entryTypeByKey.get("note") ?? {
    id: entryTypeRows[0].id,
    is_system_action: entryTypeRows[0].is_system_action,
  };

  // Build props for the type-specific data the parser extracted. The schema
  // editor (Prompt 5) will eventually own this layout; for now we use the
  // system-default field keys.
  const props: Record<string, unknown> = {};
  if (parsed.type === "risk") {
    if (parsed.probability !== undefined) props.probability = parsed.probability;
    if (parsed.impact !== undefined) props.impact = parsed.impact;
    props.status = "open";
  }
  if (parsed.type === "decision") {
    props.status = "proposed";
  }
  if (parsed.money !== undefined) props.money = parsed.money;

  // 1. Insert the entry row.
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      project_id: projectId,
      author_id: user.id,
      entry_type_id: resolvedType.id,
      body_md: parsed.body,
      source_meeting_id: meetingId ?? null,
      props,
    })
    .select("id, entry_type_id, body_md, occurred_at, project_id, author_id, source_meeting_id, props")
    .single();

  if (entryErr || !entry) {
    return { ok: false, error: entryErr?.message ?? "Failed to insert entry." };
  }

  // 2. Resolve people by short_id (lowercased, project-scoped).
  const personIdsByShort: Record<string, string> = {};
  if (parsed.refs.people.length > 0) {
    const { data: peopleRows } = await supabase
      .from("people")
      .select("id, short_id")
      .eq("project_id", projectId)
      .in("short_id", parsed.refs.people);
    for (const p of peopleRows ?? []) personIdsByShort[p.short_id] = p.id;
  }

  // 3. Resolve / stub items by ref_code (project-scoped). Stubs use the
  // project's first item type so they always have a valid type_id.
  const itemIdsByRef: Record<string, string> = {};
  if (parsed.refs.items.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, ref_code")
      .eq("project_id", projectId)
      .in("ref_code", parsed.refs.items);
    for (const it of itemRows ?? []) itemIdsByRef[it.ref_code] = it.id;

    const missing = parsed.refs.items.filter((r) => !(r in itemIdsByRef));
    if (missing.length > 0) {
      // Pick a default type for stubs — prefer "other" if it exists, else
      // the first sorted type.
      const { data: typeRows } = await supabase
        .from("item_types")
        .select("id, key, sort_order")
        .eq("project_id", projectId)
        .order("sort_order");
      const defaultType =
        typeRows?.find((t) => t.key === "other") ?? typeRows?.[0] ?? null;

      if (defaultType) {
        const { data: stubs } = await supabase
          .from("items")
          .insert(
            missing.map((ref_code) => ({
              project_id: projectId,
              ref_code,
              title: ref_code,
              type_id: defaultType.id,
            })),
          )
          .select("id, ref_code");
        for (const s of stubs ?? []) itemIdsByRef[s.ref_code] = s.id;
      }
    }
  }

  // 4. If the entry's type is the system "action", insert the thin row.
  if (resolvedType.is_system_action) {
    const ownerId = pickOwner(parsed.refs.people, personIdsByShort);
    await supabase.from("actions").insert({
      entry_id: entry.id,
      owner_person_id: ownerId,
      requester_person_id: null,
      due_at: parsed.due ? new Date(parsed.due + "T17:00:00").toISOString() : null,
      status: parsed.doneShortcut ? "done" : "open",
      done_at: parsed.doneShortcut ? new Date().toISOString() : null,
    });
  }

  // For risks: stash owner_person_id in props (no specialised table anymore).
  if (parsed.type === "risk") {
    const ownerId = pickOwner(parsed.refs.people, personIdsByShort);
    if (ownerId) {
      const nextProps = { ...(entry.props as Record<string, unknown>), owner_person_id: ownerId };
      await supabase.from("entries").update({ props: nextProps }).eq("id", entry.id);
    }
  }

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

  return {
    ok: true,
    entry: {
      id: entry.id,
      type: parsed.type,
      body_md: entry.body_md,
      occurred_at: entry.occurred_at,
      project_id: entry.project_id,
      author_id: entry.author_id,
      source_meeting_id: entry.source_meeting_id,
    },
  };
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
