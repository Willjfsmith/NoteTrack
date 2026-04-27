import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchActions, fetchProjectPeople } from "@/lib/actions/fetch-actions";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";
import { ActionsRegister } from "./actions-register";

export const dynamic = "force-dynamic";

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code")
    .eq("code", code)
    .single();
  if (!project) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tab = (sp.tab as "on-you" | "i-requested" | "watching" | "all") ?? "on-you";
  const [rows, people] = await Promise.all([
    fetchActions(project.id, { tab, userId: user?.id ?? null }),
    fetchProjectPeople(project.id),
  ]);

  return (
    <div className="-mx-[22px] -mt-[18px] -mb-[60px]">
      <RefreshOnChange table="entries" filter={`project_id=eq.${project.id}`} />
      <ActionsRegister
        projectCode={project.code}
        initial={rows}
        people={people}
        initialTab={tab}
      />
    </div>
  );
}
