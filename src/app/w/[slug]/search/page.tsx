import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext, href } from "@/lib/workspace/context";
import { searchWorkspace } from "@/lib/search";
import { PageHeader } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";

export default async function SearchPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q = "" } = await searchParams;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const hits = q ? await searchWorkspace(ctx.workspace.id, q, 60) : [];
  const rows = hits.filter((h) => h.kind === "row");
  const entries = hits.filter((h) => h.kind === "entry");

  return (
    <>
      <PageHeader label={ctx.workspace.name} title="Search" />
      <SearchBox initial={q} />
      {q && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <section>
            <p className="label mb-1">Rows <span className="font-mono text-ink-4">{rows.length}</span></p>
            <div className="divide-y divide-line rounded-3 border border-line bg-surface">
              {rows.length === 0 && <p className="px-3 py-3 text-[12.5px] text-ink-4">No rows.</p>}
              {rows.map((h) => (
                <Link key={h.id} href={href.row(slug, h.ref_code ?? "")} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-bg-2">
                  <span className="chip">#{h.ref_code}</span>
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  <span className="font-mono text-[10.5px] text-ink-4">{h.snippet}</span>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <p className="label mb-1">Entries <span className="font-mono text-ink-4">{entries.length}</span></p>
            <div className="divide-y divide-line rounded-3 border border-line bg-surface">
              {entries.length === 0 && <p className="px-3 py-3 text-[12.5px] text-ink-4">No entries.</p>}
              {entries.map((h) => {
                const day = h.occurred_at.slice(0, 10);
                return (
                  <Link key={h.id} href={`${href.diary(slug)}?from=${day}&to=${day}#${h.id}`} className="block px-3 py-1.5 text-[12.5px] hover:bg-bg-2">
                    <div className="flex items-center gap-2 font-mono text-[10.5px] text-ink-4">
                      <span>{new Date(h.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>{h.title}</span>
                    </div>
                    <Snippet text={h.snippet} />
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/** ts_headline wraps matches in ** … ** */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <p className="text-ink-2">
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded-1 bg-accent-bg px-0.5 text-ink">{p}</mark> : <span key={i}>{p}</span>))}
    </p>
  );
}
