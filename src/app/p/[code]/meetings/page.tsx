import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMeetings } from "@/lib/meetings/fetch-meetings";
import { MeetingsRegister } from "./meetings-register";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code")
    .eq("code", code)
    .single();
  if (!project) return null;

  const meetings = await fetchMeetings(project.id);

  return (
    <div className="-mx-[22px] -mt-[18px] -mb-[60px]">
      <MeetingsRegister
        projectId={project.id}
        projectCode={project.code}
        initial={meetings}
      />
    </div>
  );
}
