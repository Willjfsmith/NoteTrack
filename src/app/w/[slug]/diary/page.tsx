import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import Link from "next/link";
import { getWorkspaceContext, href, tableByKind } from "@/lib/workspace/context";
import { fetchEntries } from "@/lib/entries/fetch";
import { fetchRowByRef, fetchRowRefs } from "@/lib/rows/fetch";
import { Composer } from "@/components/composer/composer";
import { EntryList } from "@/components/diary/entry-list";
import { DiaryFilters } from "@/components/diary/diary-filters";
import { PageHeader } from "@/components/shell/page-header";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";

export default async function DiaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ project?: string; from?: string; to?: string; n?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const projectsTable = tableByKind(ctx, "projects");
  const peopleTable = tableByKind(ctx, "people");
  const projects = projectsTable ? await fetchRowRefs(projectsTable.id) : [];
  const project = sp.project ? await fetchRowByRef(ctx.workspace.id, sp.project) : null;

  const PAGE = 300;
  const limit = Math.min(5000, Math.max(PAGE, Number(sp.n) || PAGE));
  const fetched = await fetchEntries(ctx.workspace.id, {
    projectRowId: project?.id,
    from: sp.from,
    to: sp.to,
    includeStruck: true,
    limit: limit + 1,
  });
  const hasMore = fetched.length > limit;
  const entries = hasMore ? fetched.slice(0, limit) : fetched;
  const olderParams = new URLSearchParams({ ...(sp.project ? { project: sp.project } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), n: String(limit + PAGE) });

  const exportParams: Record<string, string> = {};
  if (sp.project) exportParams.project = sp.project;
  if (sp.from) exportParams.from = sp.from;
  if (sp.to) exportParams.to = sp.to;

  return (
    <>
      <RefreshOnChange table="entries" filter={`workspace_id=eq.${ctx.workspace.id}`} />
      <PageHeader
        label={ctx.workspace.name}
        title={project ? `Diary · ${project.title}` : "Diary"}
        actions={
          <>
            <DiaryFilters projects={projects.map((p) => ({ ref: p.ref_code, title: p.title }))} />
            <Link
              href={href.export(slug, { kind: "diary", ...exportParams })}
              className="inline-flex items-center gap-1 rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-2 hover:border-line-3"
              title="Export this view as Markdown"
            >
              <Download className="h-3 w-3" /> .md
            </Link>
          </>
        }
      />
      <Composer
        ctx={{ workspaceId: ctx.workspace.id, peopleTableId: peopleTable?.id, projectRowId: project?.id }}
        autoFocus
      />
      <div className="mt-5">
        <EntryList slug={slug} entries={entries} />
        {hasMore && (
          <div className="mt-3 text-center">
            <Link href={`${href.diary(slug)}?${olderParams.toString()}`} className="inline-block rounded-2 border border-line bg-surface px-3 py-1 text-[12px] text-ink-2 hover:border-line-3">
              Show older entries
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
