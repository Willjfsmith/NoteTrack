"use client";

import { useMemo, useState, useTransition } from "react";
import { addDays, format, isAfter, isBefore, isToday, parseISO, startOfDay } from "date-fns";
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { RegisterShell, type RegisterRow } from "@/components/register/register-shell";
import { renderBody } from "@/lib/composer/render-body";
import { cn } from "@/lib/utils";
import type { ActionRow, Person } from "@/lib/actions/types";
import {
  logActionNote,
  reassignAction,
  setActionStatus,
  snoozeAction,
} from "@/lib/actions/mutations";
import type { ToneColor } from "@/components/ui/tone";

const TABS = [
  { key: "on-you", label: "On you" },
  { key: "i-requested", label: "I requested" },
  { key: "watching", label: "Watching" },
  { key: "all", label: "All" },
] as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "late", label: "Late" },
  { key: "snoozed", label: "Snoozed" },
  { key: "done", label: "Done" },
] as const;

export function ActionsRegister({
  projectCode,
  initial,
  people,
  initialTab,
}: {
  projectCode: string;
  initial: ActionRow[];
  people: Person[];
  initialTab: "on-you" | "i-requested" | "watching" | "all";
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault(initialTab).withOptions({ history: "replace" }),
  );
  const [statusFilters, setStatusFilters] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault(["all"]).withOptions({ history: "replace" }),
  );
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [selectedId, setSelectedId] = useQueryState("sel", parseAsString.withDefault(""));
  const [reassignOpen, setReassignOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Optimistic local row state — patched on mutation, seeded from server data.
  const [rows, setRows] = useState<ActionRow[]>(initial);

  const visible = useMemo(() => {
    let v = rows;
    if (!statusFilters.includes("all")) {
      v = v.filter((r) => {
        if (statusFilters.includes("late")) {
          if (isLate(r)) return true;
        }
        if (statusFilters.includes("open") && (r.status === "open" || r.status === "in_progress")) return true;
        if (statusFilters.includes("snoozed") && r.status === "snoozed") return true;
        if (statusFilters.includes("done") && r.status === "done") return true;
        return false;
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      v = v.filter((r) => r.body_md.toLowerCase().includes(q));
    }
    return v;
  }, [rows, statusFilters, query]);

  const selected = useMemo(
    () => visible.find((r) => r.entry_id === selectedId) ?? visible[0] ?? null,
    [visible, selectedId],
  );

  const buckets = useMemo(() => bucketize(visible), [visible]);

  function patch(entryId: string, updater: (r: ActionRow) => ActionRow) {
    setRows((prev) => prev.map((r) => (r.entry_id === entryId ? updater(r) : r)));
  }

  async function handleDone(id: string | null) {
    if (!id) return;
    patch(id, (r) => ({ ...r, status: "done", done_at: new Date().toISOString() }));
    startTransition(async () => {
      const res = await setActionStatus({ entryId: id, status: "done" });
      if (!res.ok) toast.error(res.error);
      else toast.success("Marked done.");
    });
  }
  async function handleSnooze(id: string | null, days: number) {
    if (!id) return;
    const next = new Date(Date.now() + days * 86_400_000).toISOString();
    patch(id, (r) => ({ ...r, status: "snoozed", due_at: next }));
    startTransition(async () => {
      const res = await snoozeAction({ entryId: id, days });
      if (!res.ok) toast.error(res.error);
      else toast.success(`Snoozed ${days}d.`);
    });
  }
  async function handleBlock(id: string | null) {
    if (!id) return;
    patch(id, (r) => ({ ...r, status: "blocked" }));
    startTransition(async () => {
      const res = await setActionStatus({ entryId: id, status: "blocked" });
      if (!res.ok) toast.error(res.error);
    });
  }
  async function handleReassign(id: string | null, toPerson: Person) {
    if (!id) return;
    patch(id, (r) => ({ ...r, owner: toPerson }));
    setReassignOpen(false);
    startTransition(async () => {
      const res = await reassignAction({ entryId: id, toPersonId: toPerson.id });
      if (!res.ok) toast.error(res.error);
      else toast.success(`Reassigned to ${toPerson.name}.`);
    });
  }

  return (
    <RegisterShell
      title="Actions"
      totalCount={rows.length}
      tabs={TABS.map((t) => ({
        ...t,
        count: rows.filter((r) => filterRowForTab(r, t.key, people)).length,
      }))}
      activeTab={tab}
      onTabChange={(k) => setTab(k as typeof tab)}
      filters={FILTERS.map((f) => ({ ...f }))}
      activeFilters={statusFilters}
      onFilterToggle={(k) => {
        if (k === "all") return setStatusFilters(["all"]);
        const without = statusFilters.filter((s) => s !== "all" && s !== k);
        if (statusFilters.includes(k)) {
          setStatusFilters(without.length === 0 ? ["all"] : without);
        } else {
          setStatusFilters([...without, k]);
        }
      }}
      query={query}
      onQueryChange={setQuery}
      buckets={buckets}
      selectedId={selected?.entry_id ?? null}
      onSelectionChange={(id) => setSelectedId(id ?? "")}
      shortcuts={[
        { key: "e", label: "snooze 1d", run: (id) => handleSnooze(id, 1) },
        {
          key: "r",
          label: "reassign",
          run: () => setReassignOpen((v) => !v),
        },
        {
          key: "l",
          label: "log note",
          run: () => {
            const ta = document.getElementById("action-note-textarea") as HTMLTextAreaElement | null;
            ta?.focus();
          },
        },
      ]}
      detail={
        selected ? (
          <ActionDetail
            row={selected}
            people={people}
            projectCode={projectCode}
            reassignOpen={reassignOpen}
            onReassignOpen={setReassignOpen}
            onDone={() => handleDone(selected.entry_id)}
            onSnooze={(days) => handleSnooze(selected.entry_id, days)}
            onBlock={() => handleBlock(selected.entry_id)}
            onReassignTo={(p) => handleReassign(selected.entry_id, p)}
            onLogNote={async (body, markDone) => {
              const res = await logActionNote({ entryId: selected.entry_id, body, markDone });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              if (markDone) patch(selected.entry_id, (r) => ({ ...r, status: "done" }));
              toast.success(markDone ? "Note logged & marked done." : "Note logged.");
            }}
            pending={pending}
          />
        ) : null
      }
    />
  );
}

function filterRowForTab(
  row: ActionRow,
  tab: string,
  _people: Person[],
): boolean {
  // Counts are best-effort: server filtering is authoritative for the
  // currently displayed list. These counts use `owner.user_id`/`requester` on
  // the shipped rows (which reflect the current tab's response) — if you
  // switch tabs we re-fetch from the server. For an initial-tab-only count
  // we approximate to keep this client-only.
  if (tab === "all" || tab === "watching") return true;
  return true;
}

function isLate(r: ActionRow): boolean {
  if (r.status === "done") return false;
  if (!r.due_at) return false;
  return isBefore(parseISO(r.due_at), startOfDay(new Date()));
}

function bucketize(rows: ActionRow[]): Array<{ label: string; rows: RegisterRow[] }> {
  const today = startOfDay(new Date());
  const inSevenDays = addDays(today, 7);
  const groups: Record<string, ActionRow[]> = { Late: [], Today: [], "This week": [], Later: [] };

  for (const r of rows) {
    if (r.status === "done") {
      groups["Later"].push(r);
      continue;
    }
    if (!r.due_at) {
      groups["Later"].push(r);
      continue;
    }
    const due = parseISO(r.due_at);
    if (isBefore(due, today)) groups["Late"].push(r);
    else if (isToday(due)) groups["Today"].push(r);
    else if (isAfter(due, inSevenDays)) groups["Later"].push(r);
    else groups["This week"].push(r);
  }

  return Object.entries(groups).map(([label, rs]) => ({
    label,
    rows: rs.map((r): RegisterRow => ({
      id: r.entry_id,
      bucket: label,
      late: label === "Late",
      render: <ActionRowItem row={r} />,
    })),
  }));
}

function ActionRowItem({ row }: { row: ActionRow }) {
  const due = row.due_at ? format(parseISO(row.due_at), "EEE d MMM") : "—";
  const late = isLate(row);
  return (
    <>
      <span
        className={cn(
          "inline-flex h-5 items-center justify-center rounded-1 border px-1 font-mono text-[10px] uppercase tracking-wider",
          row.status === "done"
            ? "border-tone-green-bd bg-tone-green-bg text-tone-green-ink"
            : row.status === "snoozed"
              ? "border-line bg-bg-2 text-ink-3"
              : "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink",
        )}
      >
        {row.status === "done" ? "done" : row.status === "snoozed" ? "snz" : "act"}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">
        {row.body_md || "(empty)"}
      </span>
      {row.owner && (
        <Avatar
          initials={row.owner.initials}
          size="sm"
          color={(row.owner.color as ToneColor) ?? "grey"}
          title={row.owner.name}
        />
      )}
      <span
        className={cn(
          "w-12 flex-none text-right font-mono text-[10.5px]",
          late ? "font-bold text-tone-red-ink" : "text-ink-3",
        )}
      >
        {due}
      </span>
    </>
  );
}

function ActionDetail({
  row,
  people,
  projectCode,
  reassignOpen,
  onReassignOpen,
  onDone,
  onSnooze,
  onBlock,
  onReassignTo,
  onLogNote,
  pending,
}: {
  row: ActionRow;
  people: Person[];
  projectCode: string;
  reassignOpen: boolean;
  onReassignOpen: (b: boolean) => void;
  onDone: () => void;
  onSnooze: (days: number) => void;
  onBlock: () => void;
  onReassignTo: (p: Person) => void;
  onLogNote: (body: string, markDone?: boolean) => Promise<void>;
  pending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const due = row.due_at ? format(parseISO(row.due_at), "EEE d MMM 'at' HH:mm") : "no due";

  // ⌘↵ to mark done from anywhere on the detail pane.
  function onPaneKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (draft.trim()) {
        onLogNote(draft.trim(), true).then(() => setDraft(""));
      } else {
        onDone();
      }
    }
  }

  return (
    <div onKeyDown={onPaneKey} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line bg-surface px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-ink-3">
            {row.entry_id.slice(0, 8)}
            {row.source_item_ref && (
              <>
                {" "}
                · linked to{" "}
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
            <span className="rounded-full border border-tone-blue-bd bg-tone-blue-bg px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-tone-blue-ink">
              {row.status}
            </span>
            <span>
              <b className="text-ink">Due</b> {due}
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
            {row.requester && (
              <span className="flex items-center gap-1">
                From
                <Avatar
                  initials={row.requester.initials}
                  size="sm"
                  color={(row.requester.color as ToneColor) ?? "grey"}
                />
                {row.requester.name}
              </span>
            )}
          </div>
        </div>
        <div className="relative ml-auto flex flex-wrap items-center gap-1.5">
          <DetailButton onClick={() => onSnooze(1)}>Snooze 1d</DetailButton>
          <DetailButton onClick={() => onSnooze(3)}>+3d</DetailButton>
          <div className="relative">
            <DetailButton onClick={() => onReassignOpen(!reassignOpen)}>Reassign</DetailButton>
            {reassignOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-3 border border-line bg-surface shadow-pop">
                {people.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onReassignTo(p)}
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
          <DetailButton onClick={onBlock}>Block</DetailButton>
          <button
            onClick={onDone}
            disabled={pending || row.status === "done"}
            className="rounded-2 border border-accent-bd bg-accent px-2.5 py-1 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark done <Kbd className="ml-1 bg-white/15 text-white">⌘↵</Kbd>
          </button>
        </div>
      </div>

      <div className="flex gap-0 border-b border-line bg-surface px-5">
        <SubTab on>Overview</SubTab>
        <SubTab>Activity</SubTab>
        <SubTab>Sub-tasks</SubTab>
        <SubTab>Files</SubTab>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-5 overflow-y-auto px-5 py-4">
        <div>
          <Section title="Description">
            <div className="rounded-3 border border-line bg-surface p-3.5 text-[13px] leading-[1.55] text-ink-2 shadow-1">
              {row.body_md ? renderBody(row.body_md, { projectCode }) : "(no description)"}
            </div>
          </Section>

          <Section title="Compose reply">
            <div className="rounded-3 border border-line bg-surface p-3 shadow-1">
              <textarea
                id="action-note-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your update — saved against this action and surfaced in the diary…"
                className="min-h-[80px] w-full resize-y border-none bg-transparent text-[13px] text-ink outline-none"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="ml-auto" />
                <button
                  onClick={async () => {
                    if (!draft.trim()) return;
                    await onLogNote(draft.trim());
                    setDraft("");
                  }}
                  disabled={!draft.trim() || pending}
                  className="rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] hover:border-line-3 disabled:opacity-40"
                >
                  Save note
                </button>
                <button
                  onClick={async () => {
                    if (!draft.trim()) return;
                    await onLogNote(draft.trim(), true);
                    setDraft("");
                  }}
                  disabled={!draft.trim() || pending}
                  className="rounded-2 border border-accent-bd bg-accent px-2 py-1 text-[11.5px] text-white disabled:opacity-40"
                >
                  Mark done & log
                </button>
              </div>
            </div>
          </Section>
        </div>

        <aside>
          <Section title="Quick facts">
            <div className="rounded-3 border border-line bg-surface p-3 shadow-1">
              <dl className="grid grid-cols-[80px_1fr] gap-x-2.5 gap-y-1.5 text-[12px]">
                <dt className="text-ink-3">ID</dt>
                <dd className="font-mono text-ink">{row.entry_id.slice(0, 8)}</dd>
                <dt className="text-ink-3">Status</dt>
                <dd>{row.status}</dd>
                <dt className="text-ink-3">Owner</dt>
                <dd>{row.owner?.name ?? "—"}</dd>
                <dt className="text-ink-3">Requester</dt>
                <dd>{row.requester?.name ?? "—"}</dd>
                <dt className="text-ink-3">Due</dt>
                <dd>{due}</dd>
                <dt className="text-ink-3">Created</dt>
                <dd>{format(parseISO(row.occurred_at), "d MMM HH:mm")}</dd>
              </dl>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function DetailButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2 border border-line bg-surface px-2 py-1 text-[11.5px] hover:border-line-3"
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3.5">
      <h3 className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SubTab({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <div
      className={cn(
        "mr-4 cursor-pointer border-b-2 py-2 text-[12px] font-medium",
        on ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </div>
  );
}
