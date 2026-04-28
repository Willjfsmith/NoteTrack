import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchRisks } from "@/lib/risks/fetch-risks";
import { fetchProjectPeople } from "@/lib/actions/fetch-actions";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";
import { RisksRegister } from "./risks-register";

export const dynamic = "force-dynamic";

export default async function RisksPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code")
    .eq("code", code)
    .single();
  if (!project) return null;

  const [rows, people] = await Promise.all([
    fetchRisks(project.id),
    fetchProjectPeople(project.id),
  ]);

  return (
    <div className="-mx-[22px] -mt-[18px] -mb-[60px]">
      <RefreshOnChange table="entries" filter={`project_id=eq.${project.id}`} />
      <RisksRegister initial={rows} people={people} projectCode={project.code} />
    </div>
  );
}
