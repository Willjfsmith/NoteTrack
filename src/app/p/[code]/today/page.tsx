import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RefChip } from "@/components/ui/ref-chip";
import { Kbd } from "@/components/ui/kbd";
import { Composer } from "@/components/composer/composer";
import { Diary } from "@/components/diary/diary";
import { fetchEntries } from "@/lib/entries/fetch-entries";

export default async function TodayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name, phase, budget_total, budget_spent, fel3_due_at")
    .eq("code", code)
    .single();

  if (!project) {
    return <div className="text-ink-3">Project not found.</div>;
  }

  const entries = await fetchEntries(project.id, { limit: 80 });

  // Pull a handful of recent items for the right-rail "Recent refs" list.
  const { data: recentItems } = await supabase
    .from("items")
    .select("ref_code")
    .eq("project_id", project.id)
    .order("updated_at", { ascending: false })
    .limit(6);

  // Pull "On you today" — actions with this user as owner due today/overdue.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myPerson } = await supabase
    .from("people")
    .select("id, short_id")
    .eq("project_id", project.id)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  let onYou: Array<{ entry_id: string; body: string; due_at: string | null }> = [];
  if (myPerson) {
    const { data: rows } = await supabase
      .from("actions")
      .select("entry_id, due_at, status, entry:entry_id ( body_md )")
      .eq("owner_person_id", myPerson.id)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6);
    onYou =
      (rows as Array<{
        entry_id: string;
        due_at: string | null;
        entry: { body_md: string } | { body_md: string }[] | null;
      }> | null)?.map((r) => ({
        entry_id: r.entry_id,
        body: Array.isArray(r.entry) ? r.entry[0]?.body_md ?? "" : r.entry?.body_md ?? "",
        due_at: r.due_at,
      })) ?? [];
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-5 border-b border-line pb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
            {format(new Date(), "EEEE · d MMM yyyy")}
          </p>
          <h1 className="mt-1.5 font-serif text-[42px] font-medium leading-[1.05] tracking-tight">
            Good morning.{" "}
            <span className="italic text-ink-3">
              {entries.length === 0 ? "Nothing logged yet —" : `${entries.length} entries so far`}
            </span>
          </h1>
          <p className="mt-2 max-w-[62ch] font-serif text-[16px] leading-[1.55] text-ink-2">
            Use the composer below to log a note, action, decision, risk or call. Type{" "}
            <b className="text-ink">#</b> to link an item, <b className="text-ink">@</b> to mention
            a person.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-4 text-[12px] text-ink-3">
            <span>
              <b className="font-medium text-ink">{project.name}</b> · {project.phase}
            </span>
            {project.fel3_due_at && (
              <span>
                <b className="font-medium text-ink">
                  {Math.max(
                    0,
                    Math.round(
                      (new Date(project.fel3_due_at).getTime() - Date.now()) / 86_400_000,
                    ),
                  )}
                </b>{" "}
                days to FEL3 gate
              </span>
            )}
            {project.budget_total != null && (
              <span>
                <b className="font-medium text-ink">
                  £{((project.budget_spent ?? 0) / 1_000_000).toFixed(1)}M
                </b>{" "}
                of £{(project.budget_total / 1_000_000).toFixed(1)}M spent
              </span>
            )}
          </div>
        </div>

        <div className="mb-5">
          <Composer projectId={project.id} autoFocus />
        </div>

        <Diary projectId={project.id} projectCode={project.code} initial={entries} />
      </div>

      <aside className="flex flex-col gap-3.5 lg:sticky lg:top-16">
        <div className="rounded-4 border border-line bg-surface shadow-1">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
            <h4 className="text-[12px] font-semibold">On you today</h4>
            <span className="ml-auto rounded font-mono text-[10px] text-ink-4">{onYou.length}</span>
          </div>
          {onYou.length === 0 ? (
            <div className="p-2 text-[12px] text-ink-3">Nothing on you.</div>
          ) : (
            <ul className="p-2">
              {onYou.map((a) => (
                <li
                  key={a.entry_id}
                  className="rounded-2 px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-bg-2"
                >
                  <div className="line-clamp-1">{a.body || "(no description)"}</div>
                  {a.due_at && (
                    <div className="mt-0.5 font-mono text-[10px] text-ink-4">
                      due {format(new Date(a.due_at), "EEE d MMM")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-4 border border-line bg-surface shadow-1">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
            <h4 className="text-[12px] font-semibold">Recent refs</h4>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {(recentItems ?? []).map((it) => (
              <RefChip
                key={it.ref_code}
                refId={it.ref_code}
                href={`/p/${project.code}/items/${it.ref_code}`}
              />
            ))}
          </div>
        </div>
        <div className="rounded-4 border border-line bg-surface p-3 text-[11.5px] text-ink-3 shadow-1">
          <span className="flex items-center gap-2">
            <Kbd>⌘K</Kbd>
            <span>open command palette</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <Kbd>⌘↵</Kbd>
            <span>submit composer</span>
          </span>
        </div>
      </aside>
    </div>
  );
}

export const dynamic = "force-dynamic";
