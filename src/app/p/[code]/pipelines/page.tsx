import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchBoard } from "@/lib/pipelines/fetch-board";
import { RefreshOnChange } from "@/components/realtime/refresh-on-change";
import { Board } from "./board";

export const dynamic = "force-dynamic";

export default async function PipelinesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, code, name")
    .eq("code", code)
    .single();
  if (!project) return null;

  const board = await fetchBoard(project.id);
  const total = board.stages.reduce((a, s) => a + s.count, 0);

  return (
    <div className="flex h-[calc(100vh-49px-18px-60px)] min-h-[600px] flex-col">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <h2 className="font-serif text-[22px] font-medium tracking-tight">Pipelines</h2>
        <span className="rounded border border-line bg-bg-2 px-1.5 py-px font-mono text-[11px] text-ink-3">
          {total} items
        </span>
        <span className="ml-auto flex items-center gap-3 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            moved this week
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-tone-red-bg" />
            late
          </span>
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <RefreshOnChange table="gate_moves" filter={`item_id=neq.00000000-0000-0000-0000-000000000000`} />
        <Board initial={board} projectCode={project.code} />
      </div>
    </div>
  );
}
