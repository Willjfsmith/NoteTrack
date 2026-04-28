"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Create a meeting entry. Meetings are entries of the system "meeting" type;
 * the specialised meetings table was retired in 0005_schema_engine.sql.
 */
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

  const { data: meetingType } = await supabase
    .from("entry_types")
    .select("id")
    .eq("project_id", v.data.projectId)
    .eq("is_system_meeting", true)
    .maybeSingle();
  if (!meetingType) {
    return { ok: false as const, error: "Project has no meeting entry type configured." };
  }

  const { data: entry, error } = await supabase
    .from("entries")
    .insert({
      project_id: v.data.projectId,
      author_id: user.id,
      entry_type_id: meetingType.id,
      body_md: v.data.title,
      props: {
        series: v.data.series ?? null,
        started_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();
  if (error || !entry) return { ok: false as const, error: error?.message ?? "Failed." };

  const { data: project } = await supabase
    .from("projects")
    .select("code")
    .eq("id", v.data.projectId)
    .maybeSingle();
  if (project?.code) revalidatePath(`/p/${project.code}/meetings`);

  return { ok: true as const, meetingId: entry.id };
}

/**
 * End a meeting by patching props.ended_at. The specialised meetings table
 * was retired in 0005_schema_engine.sql.
 */
export async function endMeeting(input: { meetingId: string }) {
  const Schema = z.object({ meetingId: z.string().uuid() });
  const v = Schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.message };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("entries")
    .select("props")
    .eq("id", v.data.meetingId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Meeting not found." };

  const props = (row.props as Record<string, unknown> | null) ?? {};
  props.ended_at = new Date().toISOString();

  const { error } = await supabase
    .from("entries")
    .update({ props })
    .eq("id", v.data.meetingId);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}
