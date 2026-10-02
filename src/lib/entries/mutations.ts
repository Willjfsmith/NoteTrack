"use server";

import { z } from "zod";
import { requireUser, fail } from "@/lib/supabase/auth";
import { revalidateWorkspace } from "@/lib/workspace/revalidate";
import { parseComposer } from "@/lib/composer/parse";
import { resolveRefs } from "./resolve-refs";
import type { EntryType, Props } from "@/lib/types";

const CreateEntry = z.object({
  workspaceId: z.string().uuid(),
  raw: z.string().min(1).max(10000),
  /** attach as live notes of this Meetings row */
  meetingRowId: z.string().uuid().optional(),
  /** project context (diary filter or the row's own project) */
  projectRowId: z.string().uuid().optional(),
  /** always link these rows (e.g. the row page the composer sits on) */
  linkRowIds: z.array(z.string().uuid()).optional(),
  /** override the timestamp (ISO) — used by backfilled notes */
  occurredAt: z.string().datetime().optional(),
});
export type CreateEntryInput = z.infer<typeof CreateEntry>;

/**
 * Create a diary entry from a raw composer line.
 *  1. parse → type, body, refs, due, p/i
 *  2. resolve refs (stubbing unknown #refs), insert the entry, write entry_refs
 *  3. for action / decision / risk: create the row in that system table, linked by source_entry_id
 */
export async function createEntry(input: CreateEntryInput) {
  const v = CreateEntry.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { workspaceId, raw, meetingRowId, projectRowId, linkRowIds, occurredAt } = v.data;

  const parsed = parseComposer(raw);
  if (!parsed.body && parsed.type === "note") return fail("Nothing to log.");
  const { rows, people, me } = await resolveRefs(supabase, workspaceId, user.id, parsed.refs);

  // Project: explicit, else inherit from the first linked row that has one.
  let project: string | null = projectRowId ?? null;
  if (!project) {
    const candidateIds = [...(linkRowIds ?? []), ...rows.map((r) => r.id)];
    if (candidateIds.length > 0) {
      const { data } = await supabase.from("rows").select("id, props").in("id", candidateIds);
      for (const r of (data ?? []) as Array<{ id: string; props: Props }>) {
        const p = r.props?.project;
        if (typeof p === "string" && p) {
          project = p;
          break;
        }
      }
    }
  }

  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      workspace_id: workspaceId,
      author_id: user.id,
      type: parsed.type,
      body_md: parsed.body,
      meeting_row_id: meetingRowId ?? null,
      project_row_id: project,
      ...(occurredAt ? { occurred_at: occurredAt } : {}),
    })
    .select("id, type, body_md, occurred_at")
    .single();
  if (error || !entry) return fail(error?.message ?? "Failed to save entry.");

  const refIds = new Set<string>([
    ...rows.map((r) => r.id),
    ...people.map((p) => p.id),
    ...(linkRowIds ?? []),
  ]);
  if (refIds.size > 0) {
    await supabase
      .from("entry_refs")
      .upsert(
        Array.from(refIds).map((row_id) => ({ entry_id: entry.id, row_id })),
        { onConflict: "entry_id,row_id", ignoreDuplicates: true },
      );
  }

  // System row for action / decision / risk.
  const kind = ({ action: "actions", decision: "decisions", risk: "risks" } as Record<string, string>)[
    parsed.type
  ];
  if (kind) {
    const { data: table } = await supabase
      .from("tables")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("kind", kind)
      .maybeSingle();
    if (table) {
      const owner = people[0]?.id ?? me?.id ?? null;
      const props: Props =
        parsed.type === "action"
          ? {
              status: parsed.doneShortcut ? "done" : "open",
              owner,
              due: parsed.due ?? null,
              project,
            }
          : parsed.type === "decision"
            ? { status: "proposed", decided_by: me?.id ?? null, project }
            : {
                probability: parsed.probability ?? 3,
                impact: parsed.impact ?? 3,
                status: "open",
                owner,
                project,
              };
      await supabase.from("rows").insert({
        workspace_id: workspaceId,
        table_id: table.id,
        title: parsed.body.slice(0, 300) || parsed.type,
        props,
        source_entry_id: entry.id,
      });
    }
  }

  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return {
    ok: true as const,
    data: entry as { id: string; type: EntryType; body_md: string; occurred_at: string },
  };
}

const EditEntry = z.object({ entryId: z.string().uuid(), body: z.string().min(1).max(10000) });

/** Replace the body, keeping the previous one as a revision. Refs are re-resolved. */
export async function editEntry(input: z.infer<typeof EditEntry>) {
  const v = EditEntry.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Invalid input");
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");

  const { data: entry } = await supabase
    .from("entries")
    .select("id, workspace_id, body_md, type")
    .eq("id", v.data.entryId)
    .maybeSingle();
  if (!entry) return fail("Entry not found.");
  const parsed = parseComposer(v.data.body);
  // Editing never changes the type; a leading slash is stripped so people can paste the same syntax.
  const body = parsed.body.trim();
  if (body === entry.body_md) return { ok: true as const };

  await supabase.from("entry_revisions").insert({
    entry_id: entry.id,
    body_md: entry.body_md,
    edited_by: user.id,
  });
  const { error } = await supabase
    .from("entries")
    .update({ body_md: body, edited_at: new Date().toISOString() })
    .eq("id", entry.id);
  if (error) return fail(error.message);

  // Re-resolve refs: keep links the body still mentions, add new ones.
  const { rows, people } = await resolveRefs(supabase, entry.workspace_id, user.id, parsed.refs);
  const keep = new Set([...rows.map((r) => r.id), ...people.map((p) => p.id)]);
  const { data: existing } = await supabase
    .from("entry_refs")
    .select("row_id, row:rows(ref_code, table_id)")
    .eq("entry_id", entry.id);
  const mentionedCodes = new Set([...parsed.refs.items, ...parsed.refs.people.map((p) => p.toLowerCase())]);
  for (const r of (existing ?? []) as unknown as Array<{ row_id: string; row: { ref_code: string } | null }>) {
    if (!r.row) continue;
    const code = r.row.ref_code;
    // drop links whose token is gone from the body (links added by context — e.g. a row page — have no token and are kept)
    const wasTokenLink = mentionedCodes.has(code) || mentionedCodes.has(code.toLowerCase());
    if (!wasTokenLink && !keep.has(r.row_id)) continue;
    keep.add(r.row_id);
  }
  await supabase.from("entry_refs").delete().eq("entry_id", entry.id);
  if (keep.size > 0) {
    await supabase
      .from("entry_refs")
      .insert(Array.from(keep).map((row_id) => ({ entry_id: entry.id, row_id })));
  }
  // keep the linked system row's title in step
  await supabase.from("rows").update({ title: body.slice(0, 300) }).eq("source_entry_id", entry.id);

  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", entry.workspace_id).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return { ok: true as const };
}

/** Strike (or un-strike) an entry. Struck entries stay in the record, shown crossed out. */
export async function strikeEntry(input: { entryId: string; struck: boolean }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data: entry } = await supabase
    .from("entries")
    .select("id, workspace_id")
    .eq("id", input.entryId)
    .maybeSingle();
  if (!entry) return fail("Entry not found.");
  const { error } = await supabase
    .from("entries")
    .update({ struck_at: input.struck ? new Date().toISOString() : null })
    .eq("id", entry.id);
  if (error) return fail(error.message);
  const { data: ws } = await supabase.from("workspaces").select("slug").eq("id", entry.workspace_id).maybeSingle();
  if (ws?.slug) revalidateWorkspace(ws.slug);
  return { ok: true as const };
}

/** Previous bodies of an entry, newest first. */
export async function listRevisions(input: { entryId: string }) {
  const { supabase, user } = await requireUser();
  if (!user) return fail("Not signed in.");
  const { data, error } = await supabase
    .from("entry_revisions")
    .select("id, body_md, replaced_at")
    .eq("entry_id", input.entryId)
    .order("replaced_at", { ascending: false });
  if (error) return fail(error.message);
  return { ok: true as const, data: (data ?? []) as Array<{ id: string; body_md: string; replaced_at: string }> };
}
