import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RefChip } from "@/components/ui/ref-chip";
import { Kbd } from "@/components/ui/kbd";

export default async function TodayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, phase, budget_total, budget_spent, fel3_due_at")
    .eq("code", code)
    .single();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-5 border-b border-line pb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
            {format(new Date(), "EEEE · d MMM yyyy")}
          </p>
          <h1 className="mt-1.5 font-serif text-[42px] font-medium leading-[1.05] tracking-tight">
            Good morning.{" "}
            <span className="italic text-ink-3">Nothing logged yet —</span>
          </h1>
          <p className="mt-2 max-w-[62ch] font-serif text-[16px] leading-[1.55] text-ink-2">
            Use the composer below to log a note, action, decision, risk or call. Type{" "}
            <b className="text-ink">#</b> to link an item, <b className="text-ink">@</b> to mention
            a person.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-4 text-[12px] text-ink-3">
            <span>
              <b className="font-medium text-ink">{project?.name}</b> · {project?.phase}
            </span>
            {project?.fel3_due_at && (
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
            {project?.budget_total != null && (
              <span>
                <b className="font-medium text-ink">
                  £{((project.budget_spent ?? 0) / 1_000_000).toFixed(1)}M
                </b>{" "}
                of £{(project.budget_total / 1_000_000).toFixed(1)}M spent
              </span>
            )}
          </div>
        </div>

        <div className="mb-5 rounded-4 border border-line bg-surface p-3 shadow-1">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border-none bg-transparent px-1 py-1.5 text-[14px] text-ink-3 outline-none"
              placeholder="Log something — start with /note, /todo, /done, /decision, /risk, /call…"
              disabled
            />
            <div className="flex gap-1">
              {(["note", "todo", "done", "decision", "risk", "call"] as const).map((t) => (
                <span
                  key={t}
                  className="cursor-default rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-ink-3"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-1 font-mono text-[10px] text-ink-4">
            Composer is read-only in this stub — wired up in Prompt 7.
          </p>
        </div>

        <div className="rounded-4 border border-dashed border-line p-8 text-center text-ink-3">
          <p className="text-[14px]">No entries yet.</p>
          <p className="mt-1 text-[12.5px]">
            Run the seed migration and add yourself as a project owner to populate this stream.
          </p>
        </div>
      </div>

      <aside className="flex flex-col gap-3.5 lg:sticky lg:top-16">
        <div className="rounded-4 border border-line bg-surface shadow-1">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
            <h4 className="text-[12px] font-semibold">On you today</h4>
            <span className="ml-auto rounded font-mono text-[10px] text-ink-4">0</span>
          </div>
          <div className="p-2 text-[12px] text-ink-3">Nothing on you.</div>
        </div>
        <div className="rounded-4 border border-line bg-surface shadow-1">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
            <h4 className="text-[12px] font-semibold">Recent refs</h4>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            <RefChip refId="SAG-mill" />
            <RefChip refId="CV-203" />
            <RefChip refId="PMP-101" />
            <RefChip refId="PID-D" />
          </div>
        </div>
        <div className="rounded-4 border border-line bg-surface p-3 text-[11.5px] text-ink-3 shadow-1">
          <span className="flex items-center gap-2">
            <Kbd>⌘K</Kbd>
            <span>open command palette</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <Kbd>G</Kbd>
            <Kbd>A</Kbd>
            <span>jump to actions</span>
          </span>
        </div>
      </aside>
    </div>
  );
}

export const dynamic = "force-dynamic";
