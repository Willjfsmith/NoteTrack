"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const StatusSchema = z.enum(["open", "in_progress", "done", "snoozed", "blocked"]);

async function projectCodeFor(entryId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entries")
    .select("projects:project_id ( code )")
    .eq("id", entryId)
    .maybeSingle();
  if (!data) return null;
  const projects = (data as { projects: { code: string } | { code: string }[] | null }).projects;
  if (!projects) return null;
  return Array.isArray(projects) ? projects[0]?.code ?? null : projects.code;
}

export async function setActionStatus(input: {
  entryId: string;
  status: "open" | "in_progress" | "done" | "snoozed" | "blocked";
}) {
  const Schema = z.object({
    entryId: z.string().uuid(),
    status: StatusSchema,
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("actions")
    .update({
      status: v.data.status,
      done_at: v.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("entry_id", v.data.entryId);

  if (error) return { ok: false as const, error: error.message };

  const code = await projectCodeFor(v.data.entryId);
  if (code) {
    revalidatePath(`/p/${code}/actions`);
    revalidatePath(`/p/${code}/today`);
  }
  return { ok: true as const };
}

export async function snoozeAction(input: { entryId: string; days: number }) {
  const Schema = z.object({
    entryId: z.string().uuid(),
    days: z.number().int().min(1).max(60),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("actions")
    .select("due_at")
    .eq("entry_id", v.data.entryId)
    .maybeSingle();

  const base = row?.due_at ? new Date(row.due_at) : new Date();
  const next = new Date(base.getTime() + v.data.days * 86_400_000);

  const { error } = await supabase
    .from("actions")
    .update({ due_at: next.toISOString(), status: "snoozed" })
    .eq("entry_id", v.data.entryId);

  if (error) return { ok: false as const, error: error.message };

  const code = await projectCodeFor(v.data.entryId);
  if (code) revalidatePath(`/p/${code}/actions`);
  return { ok: true as const, dueAt: next.toISOString() };
}

export async function reassignAction(input: { entryId: string; toPersonId: string }) {
  const Schema = z.object({
    entryId: z.string().uuid(),
    toPersonId: z.string().uuid(),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("actions")
    .update({ owner_person_id: v.data.toPersonId })
    .eq("entry_id", v.data.entryId);

  if (error) return { ok: false as const, error: error.message };

  const code = await projectCodeFor(v.data.entryId);
  if (code) revalidatePath(`/p/${code}/actions`);
  return { ok: true as const };
}

export async function logActionNote(input: { entryId: string; body: string; markDone?: boolean }) {
  const Schema = z.object({
    entryId: z.string().uuid(),
    body: z.string().min(1).max(5000),
    markDone: z.boolean().optional(),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { error } = await supabase.from("comments").insert({
    entry_id: v.data.entryId,
    author_id: user.id,
    body_md: v.data.body,
  });
  if (error) return { ok: false as const, error: error.message };

  if (v.data.markDone) {
    const { error: doneErr } = await supabase
      .from("actions")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("entry_id", v.data.entryId);
    if (doneErr) return { ok: false as const, error: doneErr.message };
  }

  const code = await projectCodeFor(v.data.entryId);
  if (code) revalidatePath(`/p/${code}/actions`);
  return { ok: true as const };
}

export async function toggleSubtask(input: { subtaskId: string; done: boolean }) {
  const Schema = z.object({
    subtaskId: z.string().uuid(),
    done: z.boolean(),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subtasks")
    .update({ done: v.data.done })
    .eq("id", v.data.subtaskId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
