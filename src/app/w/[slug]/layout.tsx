import { notFound } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { getWorkspaceContext } from "@/lib/workspace/context";

export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const nav = ctx.tables.map((t) => ({
    slug: t.slug,
    name: t.name,
    views: t.views.map((v) => ({ id: v.id, name: v.name, pinned: v.pinned })),
  }));

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar slug={ctx.workspace.slug} name={ctx.workspace.name} tables={nav} role={ctx.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-4 md:px-6">{children}</div>
      </div>
      <CommandPalette workspaceId={ctx.workspace.id} slug={ctx.workspace.slug} tables={nav} />
    </div>
  );
}
