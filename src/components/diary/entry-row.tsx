import { format, formatDistanceToNowStrict } from "date-fns";
import { renderBody } from "@/lib/composer/render-body";
import { cn } from "@/lib/utils";
import type { EntryRowData } from "@/lib/entries/types";

const TYPE_TONE: Record<EntryRowData["type"], string> = {
  note: "border-line bg-bg-2 text-ink-3",
  action: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink",
  decision: "border-tone-purple-bd bg-tone-purple-bg text-tone-purple-ink",
  risk: "border-tone-red-bd bg-tone-red-bg text-tone-red-ink",
  gate: "border-tone-green-bd bg-tone-green-bg text-tone-green-ink",
  meeting: "border-tone-yellow-bd bg-tone-yellow-bg text-tone-yellow-ink",
  call: "border-tone-orange-bd bg-tone-orange-bg text-tone-orange-ink",
};

export function EntryRow({
  entry,
  projectCode,
}: {
  entry: EntryRowData;
  projectCode: string;
}) {
  const time = new Date(entry.occurred_at);
  return (
    <article className="flex gap-3 border-b border-line py-3 last:border-b-0">
      <div className="w-16 flex-none text-right">
        <div className="font-mono text-[10.5px] text-ink-4">{format(time, "HH:mm")}</div>
        <div className="mt-0.5 font-mono text-[9.5px] text-ink-5">
          {formatDistanceToNowStrict(time, { addSuffix: true })}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider",
              TYPE_TONE[entry.type],
            )}
          >
            {entry.type}
          </span>
          {entry.action && (
            <>
              <span className="rounded-full border border-line bg-bg-2 px-1.5 py-px text-[10.5px] text-ink-3">
                {entry.action.status}
              </span>
              {entry.action.due_at && (
                <span className="rounded-full border border-tone-yellow-bd bg-tone-yellow-bg px-1.5 py-px font-mono text-[10.5px] text-tone-yellow-ink">
                  due {format(new Date(entry.action.due_at), "d MMM")}
                </span>
              )}
            </>
          )}
          {entry.risk && (
            <span className="rounded-full border border-tone-red-bd bg-tone-red-bg px-1.5 py-px font-mono text-[10.5px] text-tone-red-ink">
              p{entry.risk.probability}·i{entry.risk.impact} ({entry.risk.probability * entry.risk.impact})
            </span>
          )}
          {entry.decision && (
            <span className="rounded-full border border-tone-purple-bd bg-tone-purple-bg px-1.5 py-px text-[10.5px] text-tone-purple-ink">
              {entry.decision.status}
            </span>
          )}
        </div>
        <div className="text-[14px] leading-[1.5]">
          {renderBody(entry.body_md, { projectCode })}
        </div>
      </div>
    </article>
  );
}
