"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createMeeting(input: { projectId: string; title: string; series?: string }) {
  const Schema = z.object({
    projectId: z.string().uuid(),
    title: z.string().min(1).max(200),
    series: z.string().max(120).optional(),
  });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      project_id: v.data.projectId,
      author_id: user.id,
      type: "meeting",
      body_md: v.data.title,
    })
    .select("id")
    .single();
  if (error || !entry) return { ok: false as const, error: error?.message ?? "Failed." };

  await supabase.from("meetings").insert({
    entry_id: entry.id,
    series: v.data.series ?? null,
    started_at: new Date().toISOString(),
  });

  const { data: project } = await supabase
    .from("projects")
    .select("code")
    .eq("id", v.data.projectId)
    .maybeSingle();
  if (project?.code) revalidatePath(`/p/${project.code}/meetings`);

  return { ok: true as const, meetingId: entry.id };
}

export async function endMeeting(input: { meetingId: string }) {
  const Schema = z.object({ meetingId: z.string().uuid() });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("meetings")
    .update({ ended_at: new Date().toISOString() })
    .eq("entry_id", v.data.meetingId);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}
