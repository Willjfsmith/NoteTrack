import { notFound } from "next/navigation";
import { getWorkspaceContext, tableBySlug } from "@/lib/workspace/context";
import { fetchRowsWithLookup } from "@/lib/rows/fetch";
import { buildPickers } from "@/lib/rows/pickers";
import { PageHeader } from "@/components/shell/page-header";
import { TableView } from "@/components/table/table-view";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";

export default async function TablePage({ params }: { params: Promise<{ slug: string; table: string }> }) {
  const { slug, table: tableSlug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const table = tableBySlug(ctx, tableSlug);
  if (!table) notFound();

  const [{ rows, lookup }, pickers] = await Promise.all([
    fetchRowsWithLookup(table.id, table.properties),
    buildPickers(ctx, table.properties),
  ]);

  return (
    <>
      <RefreshOnChange table="rows" filter={`table_id=eq.${table.id}`} />
      <PageHeader label={`${ctx.workspace.name} · ${table.ref_prefix}`} title={table.name} className="mb-3" />
      <TableView slug={slug} workspaceId={ctx.workspace.id} table={table} rows={rows} lookup={lookup} pickers={pickers} canEdit={ctx.role !== "viewer"} />
    </>
  );
}
