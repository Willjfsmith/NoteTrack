"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isToday, parseISO, isFuture } from "date-fns";
import { useQueryState, parseAsString } from "nuqs";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Composer } from "@/components/composer/composer";
import { RegisterShell, type RegisterRow } from "@/components/register/register-shell";
import { renderBody } from "@/lib/composer/render-body";
import { cn } from "@/lib/utils";
import { createMeeting, endMeeting } from "@/lib/meetings/mutations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ToneColor } from "@/components/ui/tone";
import type { MeetingRow, MeetingChildEntry } from "@/lib/meetings/types";

const TABS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
] as const;

const TYPE_TONE: Record<string, string> = {
  action: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink",
  decision: "border-tone-purple-bd bg-tone-purple-bg text-tone-purple-ink",
  risk: "border-tone-red-bd bg-tone-red-bg text-tone-red-ink",
  note: "border-line bg-bg-2 text-ink-3",
  call: "border-tone-orange-bd bg-tone-orange-bg text-tone-orange-ink",
  gate: "border-tone-green-bd bg-tone-green-bg text-tone-green-ink",
  meeting: "border-tone-yellow-bd bg-tone-yellow-bg text-tone-yellow-ink",
};

export function MeetingsRegister({
  projectId,
  projectCode,
  initial,
}: {
  projectId: string;
  projectCode: string;
  initial: MeetingRow[];
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("today").withOptions({ history: "replace" }),
  );
  const [selectedId, setSelectedId] = useQueryState("sel", parseAsString.withDefault(""));
  const [meetings, setMeetings] = useState<MeetingRow[]>(initial);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (tab === "all") return meetings;
    if (tab === "live") return meetings.filter((m) => isLive(m));
    if (tab === "today")
      return meetings.filter((m) => m.started_at && isToday(parseISO(m.started_at)));
    if (tab === "upcoming")
      return meetings.filter((m) => m.started_at && isFuture(parseISO(m.started_at)));
    if (tab === "past")
      return meetings.filter(
        (m) => m.started_at && !isFuture(parseISO(m.started_at)) && !isToday(parseISO(m.started_at)),
      );
    return meetings;
  }, [meetings, tab]);

  const selected = useMemo(
    () => filtered.find((m) => m.entry_id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const buckets: Array<{ label: string; rows: RegisterRow[] }> = useMemo(() => {
    const groups: Record<string, MeetingRow[]> = { Live: [], Today: [], Upcoming: [], Past: [] };
    for (const m of filtered) {
      if (isLive(m)) groups["Live"].push(m);
      else if (m.started_at && isToday(parseISO(m.started_at))) groups["Today"].push(m);
      else if (m.started_at && isFuture(parseISO(m.started_at))) groups["Upcoming"].push(m);
      else groups["Past"].push(m);
    }
    return Object.entries(groups).map(([label, rs]) => ({
      label,
      rows: rs.map((m) => ({
        id: m.entry_id,
        bucket: label,
        late: false,
        render: <MeetingRowItem row={m} />,
      })),
    }));
  }, [filtered]);

  function handleStart() {
    const title = window.prompt("Meeting title?", "Steerco · weekly");
    if (!title) return;
    startTransition(async () => {
      const res = await createMeeting({ projectId, title });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting started.");
      // Add to local list — server will revalidate too.
      setMeetings((prev) => [
        {
          entry_id: res.meetingId,
          body_md: title,
          occurred_at: new Date().toISOString(),
          series: null,
          location: null,
          started_at: new Date().toISOString(),
          ended_at: null,
          recording_url: null,
          attendees: [],
        },
        ...prev,
      ]);
      setSelectedId(res.meetingId);
    });
  }

  function handleEnd(id: string) {
    startTransition(async () => {
      const res = await endMeeting({ meetingId: id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Meeting ended.");
      setMeetings((prev) =>
        prev.map((m) => (m.entry_id === id ? { ...m, ended_at: new Date().toISOString() } : m)),
      );
    });
  }

  return (
    <RegisterShell
      title="Meetings"
      totalCount={meetings.length}
      tabs={TABS.map((t) => ({
        ...t,
        count:
          t.key === "all"
            ? meetings.length
            : t.key === "live"
              ? meetings.filter(isLive).length
              : t.key === "today"
                ? meetings.filter((m) => m.started_at && isToday(parseISO(m.started_at))).length
                : t.key === "upcoming"
                  ? meetings.filter((m) => m.started_at && isFuture(parseISO(m.started_at))).length
                  : meetings.filter(
                      (m) =>
                        m.started_at &&
                        !isFuture(parseISO(m.started_at)) &&
                        !isToday(parseISO(m.started_at)),
                    ).length,
      }))}
      activeTab={tab}
      onTabChange={(k) => setTab(k as typeof tab)}
      buckets={buckets}
      selectedId={selected?.entry_id ?? null}
      onSelectionChange={(id) => setSelectedId(id ?? "")}
      topBanner={
        <div className="flex items-center gap-2 border-b border-line bg-bg-2 px-3 py-2">
          <button
            disabled={pending}
            onClick={handleStart}
            className="rounded-2 border border-accent-bd bg-accent px-2.5 py-1 text-[11.5px] font-medium text-white"
          >
            + Start meeting
          </button>
        </div>
      }
      detail={
        selected ? (
          <MeetingDetail
            row={selected}
            projectId={projectId}
            projectCode={projectCode}
            onEnd={() => handleEnd(selected.entry_id)}
          />
        ) : null
      }
    />
  );
}

function isLive(m: MeetingRow): boolean {
  return Boolean(m.started_at) && !m.ended_at;
}

function MeetingRowItem({ row }: { row: MeetingRow }) {
  return (
    <>
      <span className="font-mono text-[10.5px] text-ink-3">{row.entry_id.slice(0, 6)}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink">
        {row.body_md || "(untitled)"}
      </span>
      {isLive(row) && (
        <span className="inline-flex items-center gap-1 rounded-full border border-tone-red-bd bg-tone-red-bg px-1.5 py-px text-[10px] font-semibold uppercase text-tone-red-ink">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tone-red-ink" />
          live
        </span>
      )}
      <span className="font-mono text-[10.5px] text-ink-3">
        {row.started_at ? format(parseISO(row.started_at), "EEE HH:mm") : "—"}
      </span>
    </>
  );
}

function MeetingDetail({
  row,
  projectId,
  projectCode,
  onEnd,
}: {
  row: MeetingRow;
  projectId: string;
  projectCode: string;
  onEnd: () => void;
}) {
  const [children, setChildren] = useState<MeetingChildEntry[]>([]);
  const supabase = createSupabaseBrowserClient();
  const live = isLive(row);

  // Fetch meeting child entries on mount and subscribe to realtime.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("entries")
        .select("id, body_md, occurred_at, entry_type:entry_type_id ( key )")
        .eq("source_meeting_id", row.entry_id)
        .order("occurred_at", { ascending: true });
      type Row = {
        id: string;
        body_md: string;
        occurred_at: string;
        entry_type: { key: string } | { key: string }[] | null;
      };
      if (!cancelled) {
        setChildren(
          ((data ?? []) as Row[]).map((r) => {
            const et = Array.isArray(r.entry_type) ? r.entry_type[0] : r.entry_type;
            return {
              id: r.id,
              type: et?.key ?? "note",
              body_md: r.body_md,
              occurred_at: r.occurred_at,
            };
          }),
        );
      }
    }
    load();

    const ch = supabase
      .channel(`meeting-${row.entry_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "entries",
          filter: `source_meeting_id=eq.${row.entry_id}`,
        },
        (payload) => {
          // Realtime payload doesn't include the entry_types join — refetch
          // the row to get its type key. Cheap because it's a single row.
          const e = payload.new as { id: string };
          (async () => {
            const { data } = await supabase
              .from("entries")
              .select("id, body_md, occurred_at, entry_type:entry_type_id ( key )")
              .eq("id", e.id)
              .maybeSingle();
            if (!data) return;
            const raw = (data as unknown as {
              id: string;
              body_md: string;
              occurred_at: string;
              entry_type: { key: string } | { key: string }[] | null;
            });
            const et = Array.isArray(raw.entry_type) ? raw.entry_type[0] ?? null : raw.entry_type;
            const child: MeetingChildEntry = {
              id: raw.id,
              type: et?.key ?? "note",
              body_md: raw.body_md,
              occurred_at: raw.occurred_at,
            };
            setChildren((prev) => (prev.some((p) => p.id === child.id) ? prev : [...prev, child]));
          })();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [supabase, row.entry_id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line bg-surface px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-ink-3">
            meeting · {row.entry_id.slice(0, 8)}
          </div>
          <h1 className="mt-0.5 font-serif text-[22px] font-medium leading-tight tracking-tight">
            {row.body_md || "(untitled meeting)"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-tone-red-bd bg-tone-red-bg px-2 py-0.5 text-[11px] font-semibold uppercase text-tone-red-ink">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tone-red-ink" />
                live
              </span>
            ) : row.ended_at ? (
              <span className="rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11px] uppercase text-ink-3">
                wrapped
              </span>
            ) : null}
            {row.started_at && (
              <span>
                <b className="text-ink">Started</b> {format(parseISO(row.started_at), "EEE d MMM HH:mm")}
              </span>
            )}
            {row.attendees.length > 0 && (
              <span className="flex items-center gap-1">
                {row.attendees.slice(0, 6).map((a) => (
                  <Avatar
                    key={a.id}
                    initials={a.initials}
                    size="sm"
                    color={(a.color as ToneColor) ?? "grey"}
                    title={a.name}
                  />
                ))}
                {row.attendees.length} attendee{row.attendees.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {live && (
            <button
              onClick={onEnd}
              className="rounded-2 border border-line bg-surface px-2.5 py-1 text-[11.5px] hover:border-line-3"
            >
              End meeting
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-0 border-b border-line bg-surface px-5">
        <SubTab on>Notes</SubTab>
        <SubTab>
          Outputs <span className="ml-1 font-mono text-[10px]">{children.filter((c) => c.type !== "note").length}</span>
        </SubTab>
        <SubTab>Attendees</SubTab>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-5 overflow-y-auto px-5 py-4">
        <div>
          <section className="mb-3.5">
            <h3 className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Live notes
            </h3>
            <div className="rounded-3 border border-line bg-surface p-2 shadow-1">
              {children.length === 0 && (
                <div className="px-2 py-3 text-center text-[12px] text-ink-3">
                  No notes yet — type below to start capturing.
                </div>
              )}
              {children.map((c) => (
                <div
                  key={c.id}
                  className="flex gap-2.5 border-b border-line px-2 py-2 last:border-b-0"
                >
                  <span className="w-12 flex-none font-mono text-[10.5px] text-ink-4">
                    {format(parseISO(c.occurred_at), "HH:mm")}
                  </span>
                  <span
                    className={cn(
                      "h-5 flex-none rounded-1 border px-1 font-mono text-[10px] uppercase tracking-wider",
                      TYPE_TONE[c.type] ?? TYPE_TONE.note,
                    )}
                  >
                    {c.type}
                  </span>
                  <span className="flex-1 text-[13px] leading-[1.5] text-ink">
                    {renderBody(c.body_md, { projectCode })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Composer
                projectId={projectId}
                meetingId={row.entry_id}
                placeholder="Type a note. Use /action /decision /risk for outputs."
              />
            </div>
          </section>
        </div>
        <aside>
          <section>
            <h3 className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Outputs captured
            </h3>
            <div className="rounded-3 border border-line bg-surface p-2 shadow-1">
              {children.filter((c) => c.type !== "note").length === 0 ? (
                <div className="p-2 text-[12px] text-ink-3">No outputs yet.</div>
              ) : (
                children
                  .filter((c) => c.type !== "note")
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex gap-1.5 border-b border-line p-2 text-[12px] last:border-b-0"
                    >
                      <span
                        className={cn(
                          "h-5 flex-none rounded-1 border px-1 font-mono text-[10px] uppercase",
                          TYPE_TONE[c.type] ?? TYPE_TONE.note,
                        )}
                      >
                        {c.type}
                      </span>
                      <span className="line-clamp-2 text-ink-2">{c.body_md}</span>
                    </div>
                  ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
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
