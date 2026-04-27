import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ code: string }>;
  children: React.ReactNode;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name, phase, color, budget_total, budget_spent, fel3_due_at")
    .eq("code", code)
    .maybeSingle();

  if (!project) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  return (
    <div className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)] bg-bg">
      <Sidebar projectCode={project.code} projectName={project.name} />
      <div className="flex min-w-0 flex-col">
        <TopBar crumbs={["NoteTrack", project.name]} />
        <div className="w-full max-w-[1440px] px-[22px] pb-[60px] pt-[18px]">{children}</div>
      </div>
    </div>
  );
}
