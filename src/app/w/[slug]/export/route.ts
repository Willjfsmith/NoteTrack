import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext, tableBySlug } from "@/lib/workspace/context";
import { fetchEntries } from "@/lib/entries/fetch";
import { fetchLookup, fetchRowByRef, fetchRowsWithLookup } from "@/lib/rows/fetch";
import { applyView, collectRefIds } from "@/lib/props";
import { diaryToMarkdown, rowToMarkdown, tableToMarkdown } from "@/lib/export/markdown";

/** GET /w/[slug]/export?kind=diary|row|table&… → a Markdown download. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "diary";
  let md = "";
  let name = "export";

  if (kind === "diary") {
    const projectRef = sp.get("project") ?? undefined;
    const project = projectRef ? await fetchRowByRef(ctx.workspace.id, projectRef) : null;
    const from = sp.get("from") ?? undefined;
    const to = sp.get("to") ?? undefined;
    const entries = await fetchEntries(ctx.workspace.id, { projectRowId: project?.id, from, to, includeStruck: true, limit: 5000 });
    const range = [from ?? "start", to ?? "today"].join(" → ");
    md = diaryToMarkdown({ title: project ? `${ctx.workspace.name} · ${project.title} · diary` : `${ctx.workspace.name} · diary`, subtitle: range, entries });
    name = `diary-${project?.ref_code ?? "all"}-${from ?? "start"}-${to ?? "today"}`;
  } else if (kind === "row") {
    const ref = sp.get("ref");
    const row = ref ? await fetchRowByRef(ctx.workspace.id, ref) : null;
    if (!row) return new NextResponse("Not found", { status: 404 });
    const table = ctx.tables.find((t) => t.id === row.table_id);
    const lookup = await fetchLookup(collectRefIds([row], table?.properties ?? []));
    const entries = await fetchEntries(ctx.workspace.id, { rowId: row.id, includeStruck: true, limit: 5000 });
    md = rowToMarkdown({ row, tableName: table?.name ?? "Row", defs: table?.properties ?? [], lookup, entries });
    name = row.ref_code;
  } else if (kind === "table") {
    const table = tableBySlug(ctx, sp.get("table") ?? "");
    if (!table) return new NextResponse("Not found", { status: 404 });
    const view = table.views.find((v) => v.id === sp.get("view"));
    const { rows, lookup } = await fetchRowsWithLookup(table.id, table.properties);
    const visible = view ? applyView(rows, view.config, table.properties, lookup) : rows;
    md = tableToMarkdown({ tableName: view ? `${table.name} · ${view.name}` : table.name, rows: visible, defs: table.properties, lookup });
    name = `${table.slug}${view ? `-${view.name.toLowerCase().replace(/\s+/g, "-")}` : ""}`;
  } else {
    return new NextResponse("Unknown kind", { status: 400 });
  }

  return new NextResponse(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${name.replace(/[^A-Za-z0-9._-]+/g, "_")}.md"`,
    },
  });
}
