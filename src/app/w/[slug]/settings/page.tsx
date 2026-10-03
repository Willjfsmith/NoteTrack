import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { TablesSettings } from "@/components/settings/tables-settings";
import { MembersSettings } from "@/components/settings/members-settings";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  if (ctx.role === "viewer") notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: members }, { data: people }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at").eq("workspace_id", ctx.workspace.id).order("created_at"),
    supabase.from("rows").select("user_id, title, ref_code").eq("workspace_id", ctx.workspace.id).not("user_id", "is", null),
  ]);
  const byUser = new Map((people ?? []).map((p) => [p.user_id as string, p]));
  const memberRows = (members ?? []).map((m) => ({
    userId: m.user_id as string,
    role: m.role as string,
    name: byUser.get(m.user_id as string)?.title ?? "(no People row)",
    ref: byUser.get(m.user_id as string)?.ref_code ?? "",
    isMe: m.user_id === ctx.userId,
  }));

  return (
    <>
      <PageHeader label={ctx.workspace.name} title="Settings">
        <p className="mt-0.5 text-[12.5px] text-ink-3">Tables and their properties, and who can see this workspace.</p>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <TablesSettings workspaceId={ctx.workspace.id} tables={ctx.tables} />
        <MembersSettings workspaceId={ctx.workspace.id} members={memberRows} isOwner={ctx.role === "owner"} />
      </div>
    </>
  );
}
