"use client";

import { useMemo, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { RegisterShell, type RegisterRow } from "@/components/register/register-shell";
import { renderBody } from "@/lib/composer/render-body";
import { cn } from "@/lib/utils";
import { scoreColor, type RiskRow } from "@/lib/risks/types";
import { updateRisk } from "@/lib/risks/mutations";
import type { Person } from "@/lib/actions/types";
import type { ToneColor } from "@/components/ui/tone";

const TABS = [
  { key: "open", label: "Open" },
  { key: "mitigating", label: "Mitigating" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

const SCORE_TONE: Record<"green" | "yellow" | "orange" | "red", string> = {
  green: "border-tone-green-bd bg-tone-green-bg text-tone-green-ink",
  yellow: "border-tone-yellow-bd bg-tone-yellow-bg text-tone-yellow-ink",
  orange: "border-tone-orange-bd bg-tone-orange-bg text-tone-orange-ink",
  red: "border-tone-red-bd bg-tone-red-bg text-tone-red-ink",
};

export function RisksRegister({
  initial,
  people,
  projectCode,
}: {
  initial: RiskRow[];
  people: Person[];
  projectCode: string;
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("open").withOptions({ history: "replace" }),
  );
  const [cellP, setCellP] = useQueryState("p", parseAsInteger);
  const [cellI, setCellI] = useQueryState("i", parseAsInteger);
  const [selectedId, setSelectedId] = useQueryState("sel", parseAsString.withDefault(""));
  const [pending, startTransition] = useTransition();

  const [rows, setRows] = useState<RiskRow[]>(initial);

  function patch(id: string, u: (r: RiskRow) => RiskRow) {
    setRows((prev) => prev.map((r) => (r.entry_id === id ? u(r) : r)));
  }

  const filtered = useMemo(() => {
    let v = rows;
    if (tab !== "all") v = v.filter((r) => r.status === tab);
    if (cellP != null) v = v.filter((r) => r.probability === cellP);
    if (cellI != null) v = v.filter((r) => r.impact === cellI);
    return v.sort((a, b) => b.probability * b.impact - a.probability * a.impact);
  }, [rows, tab, cellP, cellI]);

  const selected = useMemo(
    () => filtered.find((r) => r.entry_id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // Heatmap cell counts.
  const heatCells = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.status === "closed") continue;
      counts[`${r.probability}-${r.impact}`] = (counts[`${r.probability}-${r.impact}`] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const buckets: Array<{ label: string; rows: RegisterRow[] }> = useMemo(() => {
    const groups: Record<string, RiskRow[]> = { Critical: [], High: [], Medium: [], Low: [] };
    for (const r of filtered) {
      const score = r.probability * r.impact;
      const c = scoreColor(score);
      if (c === "red") groups["Critical"].push(r);
      else if (c === "orange") groups["High"].push(r);
      else if (c === "yellow") groups["Medium"].push(r);
      else groups["Low"].push(r);
    }
    return Object.entries(groups).map(([label, rs]) => ({
      label,
      rows: rs.map((r) => ({
        id: r.entry_id,
        bucket: label,
        late: false,
        render: <RiskRowItem row={r} />,
      })),
    }));
  }, [filtered]);

  return (
    <RegisterShell
      title="Risks"
      totalCount={rows.length}
      tabs={TABS.map((t) => ({
        ...t,
        count: t.key === "all" ? rows.length : rows.filter((r) => r.status === t.key).length,
      }))}
      activeTab={tab}
      onTabChange={(k) => setTab(k as typeof tab)}
      buckets={buckets}
      selectedId={selected?.entry_id ?? null}
      onSelectionChange={(id) => setSelectedId(id ?? "")}
      topBanner={
        <div className="border-b border-line bg-bg-2 p-3">
          <Heatmap
            counts={heatCells}
            activeP={cellP}
            activeI={cellI}
            onCellClick={(p, i) => {
              if (cellP === p && cellI === i) {
                setCellP(null);
                setCellI(null);
              } else {
                setCellP(p);
                setCellI(i);
              }
            }}
          />
        </div>
      }
      detail={
        selected ? (
          <RiskDetail
            row={selected}
            people={people}
            projectCode={projectCode}
            pending={pending}
            onUpdate={async (patchFields) => {
              patch(selected.entry_id, (r) => ({ ...r, ...patchFields }));
              startTransition(async () => {
                const res = await updateRisk({ entryId: selected.entry_id, ...patchFields });
                if (!res.ok) toast.error(res.error);
                else toast.success("Risk updated.");
              });
            }}
          />
        ) : null
      }
    />
  );
}

function RiskRowItem({ row }: { row: RiskRow }) {
  const score = row.probability * row.impact;
  const tone = scoreColor(score);
  return (
    <>
      <span
        className={cn(
          "inline-flex h-5 min-w-[26px] items-center justify-center rounded-1 border px-1 font-mono text-[11px] font-bold",
          SCORE_TONE[tone],
        )}
      >
        {score}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink">
        {row.body_md || "(no description)"}
      </span>
      {row.owner && (
        <Avatar
          initials={row.owner.initials}
          size="sm"
          color={(row.owner.color as ToneColor) ?? "grey"}
          title={row.owner.name}
        />
      )}
      <span className="font-mono text-[10.5px] text-ink-3">
        p{row.probability}·i{row.impact}
      </span>
    </>
  );
}

function Heatmap({
  counts,
  activeP,
  activeI,
  onCellClick,
}: {
  counts: Record<string, number>;
  activeP: number | null;
  activeI: number | null;
  onCellClick: (p: number, i: number) => void;
}) {
  return (
    <div className="grid w-full max-w-[300px] grid-cols-[20px_repeat(5,_1fr)] gap-1 text-[10px]">
      <div />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={`th-${i}`} className="text-center font-mono text-ink-4">
          i{i}
        </div>
      ))}
      {[5, 4, 3, 2, 1].map((p) => (
        <Fragment key={`row-${p}`}>
          <div className="text-center font-mono text-ink-4">p{p}</div>
          {[1, 2, 3, 4, 5].map((i) => {
            const score = p * i;
            const tone = scoreColor(score);
            const ct = counts[`${p}-${i}`] ?? 0;
            const active = activeP === p && activeI === i;
            return (
              <button
                key={`c-${p}-${i}`}
                onClick={() => onCellClick(p, i)}
                title={`p${p}·i${i} — ${ct} risks`}
                className={cn(
                  "flex h-5 items-center justify-center rounded-1 border font-mono text-[10.5px]",
                  SCORE_TONE[tone],
                  active && "ring-2 ring-ink ring-offset-1",
                  ct === 0 && "opacity-40",
                )}
              >
                {ct > 0 ? ct : ""}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function RiskDetail({
  row,
  people,
  projectCode,
  pending,
  onUpdate,
}: {
  row: RiskRow;
  people: Person[];
  projectCode: string;
  pending: boolean;
  onUpdate: (patch: Partial<{ probability: number; impact: number; status: RiskRow["status"]; ownerPersonId: string | null; owner: RiskRow["owner"] }>) => Promise<void>;
}) {
  const score = row.probability * row.impact;
  const tone = scoreColor(score);
  const [reassignOpen, setReassignOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line bg-surface px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-ink-3">
            risk · {row.entry_id.slice(0, 8)}
            {row.source_item_ref && (
              <>
                {" · linked to "}
                <a
                  href={`/p/${projectCode}/items/${row.source_item_ref}`}
                  className="rounded-1 border border-line bg-bg-2 px-1 text-ink-2 hover:underline"
                >
                  #{row.source_item_ref}
                </a>
              </>
            )}
          </div>
          <h1 className="mt-0.5 font-serif text-[22px] font-medium leading-tight tracking-tight">
            {row.body_md ? renderBody(row.body_md, { projectCode }) : "(no description)"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold",
                SCORE_TONE[tone],
              )}
            >
              score {score}
            </span>
            <span>
              <b className="text-ink">p</b> {row.probability} · <b className="text-ink">i</b>{" "}
              {row.impact}
            </span>
            {row.owner && (
              <span className="flex items-center gap-1">
                Owner
                <Avatar
                  initials={row.owner.initials}
                  size="sm"
                  color={(row.owner.color as ToneColor) ?? "grey"}
                />
                <b className="text-ink">{row.owner.name}</b>
              </span>
            )}
            <span>
              Created {format(parseISO(row.occurred_at), "d MMM HH:mm")}
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            disabled={pending}
            value={row.status}
            onChange={(e) =>
              onUpdate({ status: e.target.value as RiskRow["status"] })
            }
            className="rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px]"
          >
            <option value="open">open</option>
            <option value="mitigating">mitigating</option>
            <option value="closed">closed</option>
          </select>
          <div className="relative">
            <button
              onClick={() => setReassignOpen((v) => !v)}
              className="rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] hover:border-line-3"
            >
              Reassign
            </button>
            {reassignOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-3 border border-line bg-surface shadow-pop">
                {people.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setReassignOpen(false);
                      onUpdate({
                        ownerPersonId: p.id,
                        owner: {
                          id: p.id,
                          short_id: p.short_id,
                          name: p.name,
                          initials: p.initials,
                          color: p.color,
                        },
                      });
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-bg-2"
                  >
                    <Avatar
                      initials={p.initials}
                      size="sm"
                      color={(p.color as ToneColor) ?? "grey"}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-[10px] text-ink-4">{p.short_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-5 overflow-y-auto px-5 py-4">
        <div>
          <section className="mb-3.5">
            <h3 className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Description
            </h3>
            <div className="rounded-3 border border-line bg-surface p-3.5 text-[13px] leading-[1.55] text-ink-2 shadow-1">
              {row.body_md ? renderBody(row.body_md, { projectCode }) : "(no description)"}
            </div>
          </section>
        </div>
        <aside>
          <section>
            <h3 className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Score
            </h3>
            <div className="rounded-3 border border-line bg-surface p-3 shadow-1">
              <div className="flex items-center gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] uppercase tracking-wider text-ink-3">
                    Probability
                  </label>
                  <select
                    disabled={pending}
                    value={row.probability}
                    onChange={(e) => onUpdate({ probability: Number(e.target.value) })}
                    className="w-16 rounded-2 border border-line bg-surface px-2 py-1 text-[12px]"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] uppercase tracking-wider text-ink-3">
                    Impact
                  </label>
                  <select
                    disabled={pending}
                    value={row.impact}
                    onChange={(e) => onUpdate({ impact: Number(e.target.value) })}
                    className="w-16 rounded-2 border border-line bg-surface px-2 py-1 text-[12px]"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                    score
                  </div>
                  <div
                    className={cn(
                      "rounded-2 border px-2 py-0.5 font-mono text-[16px] font-semibold",
                      SCORE_TONE[tone],
                    )}
                  >
                    {score}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
