import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import type { ToneColor } from "@/components/ui/tone";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("code", code)
    .single();
  if (!project) return null;

  const { data: people } = await supabase
    .from("people")
    .select("id, short_id, name, initials, color, role_label, user_id")
    .eq("project_id", project.id)
    .order("name");

  const selected = people?.find((p) => p.short_id === sp.p) ?? null;

  // Pull recent activity for the selected person.
  let owned: Array<{ entry_id: string; body_md: string; status: string; due_at: string | null }> = [];
  let risks: Array<{ entry_id: string; body_md: string; probability: number; impact: number; status: string }> = [];
  let recent: Array<{ id: string; type: string; body_md: string; occurred_at: string }> = [];

  if (selected) {
    const { data: a } = await supabase
      .from("actions")
      .select("entry_id, status, due_at, entry:entry_id ( body_md, project_id )")
      .eq("owner_person_id", selected.id);
    owned =
      ((a ?? []) as Array<{
        entry_id: string;
        status: string;
        due_at: string | null;
        entry: { body_md: string; project_id: string } | { body_md: string; project_id: string }[] | null;
      }>)
        .map((row) => {
          const entry = Array.isArray(row.entry) ? row.entry[0] : row.entry;
          if (!entry || entry.project_id !== project.id) return null;
          return {
            entry_id: row.entry_id,
            body_md: entry.body_md,
            status: row.status,
            due_at: row.due_at,
          };
        })
        .filter(Boolean) as typeof owned;

    // Risks now live in entries.props with entry_type.key === 'risk'.
    const { data: riskType } = await supabase
      .from("entry_types")
      .select("id")
      .eq("project_id", project.id)
      .eq("key", "risk")
      .maybeSingle();
    if (riskType) {
      const { data: rk } = await supabase
        .from("entries")
        .select("id, body_md, props")
        .eq("project_id", project.id)
        .eq("entry_type_id", riskType.id);
      type RiskEntry = { id: string; body_md: string; props: Record<string, unknown> | null };
      risks = ((rk ?? []) as RiskEntry[])
        .map((row) => {
          const props = row.props ?? {};
          if (props.owner_person_id !== selected.id) return null;
          const probability = typeof props.probability === "number" ? (props.probability as number) : null;
          const impact = typeof props.impact === "number" ? (props.impact as number) : null;
          if (probability == null || impact == null) return null;
          return {
            entry_id: row.id,
            body_md: row.body_md,
            probability,
            impact,
            status: (props.status as string) ?? "open",
          };
        })
        .filter(Boolean) as typeof risks;
    }

    // Activity = entries that reference this person, joined to entry_types for the type label.
    const { data: refs } = await supabase
      .from("entry_refs")
      .select(
        `entry:entry_id (
           id, body_md, occurred_at, project_id,
           entry_type:entry_type_id ( key )
         )`,
      )
      .eq("ref_kind", "person")
      .eq("ref_id", selected.id)
      .limit(20);
    type ActivityRow = {
      entry: {
        id: string;
        body_md: string;
        occurred_at: string;
        project_id: string;
        entry_type: { key: string } | { key: string }[] | null;
      } | {
        id: string;
        body_md: string;
        occurred_at: string;
        project_id: string;
        entry_type: { key: string } | { key: string }[] | null;
      }[]
        | null;
    };
    recent =
      ((refs ?? []) as ActivityRow[])
        .map((r) => (Array.isArray(r.entry) ? r.entry[0] : r.entry))
        .filter(
          (e): e is {
            id: string;
            body_md: string;
            occurred_at: string;
            project_id: string;
            entry_type: { key: string } | { key: string }[] | null;
          } => Boolean(e) && e!.project_id === project.id,
        )
        .map((e) => {
          const et = Array.isArray(e.entry_type) ? e.entry_type[0] : e.entry_type;
          return { id: e.id, type: et?.key ?? "note", body_md: e.body_md, occurred_at: e.occurred_at };
        })
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(0, 12);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <h2 className="mb-3 font-serif text-[22px] font-medium tracking-tight">People</h2>
        <ul className="overflow-hidden rounded-4 border border-line bg-surface shadow-1">
          {(people ?? []).map((p) => (
            <li
              key={p.id}
              className={
                "flex items-center gap-3 border-b border-line px-3.5 py-2 text-[12.5px] last:border-b-0 " +
                (selected?.id === p.id ? "bg-accent-bg" : "hover:bg-bg-2")
              }
            >
              <Avatar initials={p.initials} size="lg" color={(p.color as ToneColor) ?? "grey"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{p.name}</div>
                <div className="font-mono text-[10.5px] text-ink-3">
                  @{p.short_id}
                  {p.role_label && <span> · {p.role_label}</span>}
                </div>
              </div>
              <a
                href={`/p/${project.code}/people?p=${encodeURIComponent(p.short_id)}`}
                className="rounded-2 border border-line bg-bg-2 px-2 py-0.5 text-[11px] hover:border-line-3"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-16">
        {selected ? (
          <div className="rounded-4 border border-line bg-surface shadow-1">
            <div className="flex items-center gap-3 border-b border-line p-4">
              <Avatar
                initials={selected.initials}
                size="xl"
                color={(selected.color as ToneColor) ?? "grey"}
              />
              <div>
                <div className="font-serif text-[20px] font-medium tracking-tight">{selected.name}</div>
                <div className="font-mono text-[11px] text-ink-3">
                  @{selected.short_id}
                  {selected.role_label && <span> · {selected.role_label}</span>}
                </div>
              </div>
            </div>
            <Section title={`Owned actions (${owned.length})`}>
              {owned.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="text-[12.5px]">
                  {owned.slice(0, 8).map((a) => (
                    <li key={a.entry_id} className="border-b border-line px-3.5 py-1.5 last:border-b-0">
                      <span className="line-clamp-1">{a.body_md}</span>
                      <span className="font-mono text-[10.5px] text-ink-4">
                        {a.status}
                        {a.due_at && ` · due ${format(new Date(a.due_at), "d MMM")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title={`Owned risks (${risks.length})`}>
              {risks.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="text-[12.5px]">
                  {risks.slice(0, 8).map((r) => (
                    <li
                      key={r.entry_id}
                      className="border-b border-line px-3.5 py-1.5 last:border-b-0"
                    >
                      <span className="line-clamp-1">{r.body_md}</span>
                      <span className="font-mono text-[10.5px] text-ink-4">
                        p{r.probability}·i{r.impact} · {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title={`Recent activity (${recent.length})`}>
              {recent.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                <ul className="text-[12.5px]">
                  {recent.slice(0, 8).map((r) => (
                    <li key={r.id} className="border-b border-line px-3.5 py-1.5 last:border-b-0">
                      <span className="font-mono text-[10px] uppercase text-ink-4">{r.type}</span>{" "}
                      <span>{r.body_md}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        ) : (
          <div className="rounded-4 border border-dashed border-line p-8 text-center text-ink-3">
            Select a person to see their profile.
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="border-b border-line bg-bg-2 px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3.5 py-3 text-[12px] italic text-ink-4">{children}</div>;
}
