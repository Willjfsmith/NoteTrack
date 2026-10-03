import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getWorkspaceContext, href, tableByKind, tableById } from "@/lib/workspace/context";
import { fetchLookup, fetchRowByRef } from "@/lib/rows/fetch";
import { buildPickers } from "@/lib/rows/pickers";
import { fetchBacklinks } from "@/lib/rows/backlinks";
import { fetchEntries } from "@/lib/entries/fetch";
import { collectRefIds, formatProp } from "@/lib/props";
import { Composer } from "@/components/composer/composer";
import { EntryList } from "@/components/diary/entry-list";
import { PageHeader } from "@/components/shell/page-header";
import { RowHeader } from "@/components/row/row-header";
import { PropertiesPanel } from "@/components/row/properties-panel";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";
import { Tone } from "@/components/ui/tone";
import { TYPE_TONE } from "@/lib/entry-tones";

export default async function RowPage({ params }: { params: Promise<{ slug: string; ref: string }> }) {
  const { slug, ref } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const row = await fetchRowByRef(ctx.workspace.id, decodeURIComponent(ref));
  if (!row) notFound();
  const table = tableById(ctx, row.table_id);
  if (!table) notFound();
  const people = tableByKind(ctx, "people");
  const isMeeting = table.kind === "meetings";

  const [lookup, pickers, entries, backlinks] = await Promise.all([
    fetchLookup(collectRefIds([row], table.properties)),
    buildPickers(ctx, table.properties),
    fetchEntries(ctx.workspace.id, { rowId: row.id, includeStruck: true, limit: 500, ascending: isMeeting }),
    fetchBacklinks(ctx, row),
  ]);
  const projectId = typeof row.props.project === "string" ? row.props.project : table.kind === "projects" ? row.id : undefined;
  const outputs = isMeeting ? entries.filter((e) => e.type !== "note" && !e.struck_at) : [];
  const canEdit = ctx.role !== "viewer";

  return (
    <>
      <RefreshOnChange table="entries" filter={`workspace_id=eq.${ctx.workspace.id}`} />
      <PageHeader
        label={`${table.name} · #${row.ref_code}${row.archived_at ? " · archived" : ""}`}
        title={<RowHeader row={row} canEdit={canEdit} />}
        actions={
          <Link href={href.export(slug, { kind: "row", ref: row.ref_code })} className="inline-flex items-center gap-1 rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-2 hover:border-line-3" title="Export as Markdown">
            <Download className="h-3 w-3" /> .md
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {isMeeting && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-3 border border-line bg-surface px-2.5 py-1.5 text-[12px]">
              <span className="label">Outputs</span>
              {outputs.length === 0 && <span className="text-ink-4">none yet — use /action /decision /risk in the notes</span>}
              {(["action", "decision", "risk", "gate", "call"] as const).map((t) => {
                const n = outputs.filter((e) => e.type === t).length;
                return n > 0 ? <Tone key={t} color={TYPE_TONE[t]}>{n} {t}{n === 1 ? "" : "s"}</Tone> : null;
              })}
            </div>
          )}
          <Composer
            ctx={{
              workspaceId: ctx.workspace.id,
              peopleTableId: people?.id,
              projectRowId: projectId,
              meetingRowId: isMeeting ? row.id : undefined,
              linkRowIds: isMeeting ? undefined : [row.id],
            }}
            placeholder={isMeeting ? "Meeting notes… each line is an entry; /action /decision /risk make outputs" : `Note something about #${row.ref_code}…`}
            compact
          />
          <div className="mt-4">
            <EntryList slug={slug} entries={entries} ascending={isMeeting} emptyText={`Nothing references #${row.ref_code} yet.`} compact />
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3 border border-line bg-surface p-2.5">
            <p className="label mb-1.5">Properties</p>
            <PropertiesPanel row={row} defs={table.properties} lookup={lookup} pickers={pickers} slug={slug} canEdit={canEdit} />
          </section>

          {backlinks.map((g) => (
            <section key={g.table.id + g.property.key} className="rounded-3 border border-line bg-surface p-2.5">
              <p className="label mb-1.5">
                {g.table.name} <span className="text-ink-4">· {g.property.name}</span>
                <span className="ml-1 font-mono text-ink-4">{g.rows.length}</span>
              </p>
              <ul className="space-y-0.5 text-[12px]">
                {g.rows.slice(0, 25).map((r) => {
                  const status = g.table.properties.find((d) => d.key === "status");
                  const st = status ? formatProp(status, r.props.status ?? null) : "";
                  return (
                    <li key={r.id} className="flex items-center gap-1.5">
                      <Link href={href.row(slug, r.ref_code)} className="min-w-0 flex-1 truncate text-ink hover:text-accent hover:underline">{r.title}</Link>
                      {st && <span className="font-mono text-[10px] text-ink-4">{st}</span>}
                    </li>
                  );
                })}
                {g.rows.length > 25 && (
                  <li>
                    <Link href={`${href.table(slug, g.table.slug)}?f=${encodeURIComponent(`${g.property.key}:eq:${row.id}`)}`} className="text-[11.5px] text-ink-3 hover:text-ink">
                      all {g.rows.length} →
                    </Link>
                  </li>
                )}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
