"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, isPast, parseISO, isToday } from "date-fns";
import { FileText, History, MoreHorizontal, Pencil, RotateCcw, Strikethrough } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tone } from "@/components/ui/tone";
import { TYPE_TONE } from "@/lib/entry-tones";
import { renderBody } from "@/lib/composer/render-body";
import { editEntry, listRevisions, strikeEntry } from "@/lib/entries/mutations";
import { riskScore } from "@/lib/props";
import type { EntryWithUrls } from "@/lib/entries/fetch";

const TOKEN_RE = /(?<![A-Za-z0-9_])[#@]([A-Za-z0-9][\w-]{0,63})/g;

export function EntryRow({ entry, slug, compact = false }: { entry: EntryWithUrls; slug: string; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body_md);
  const [menu, setMenu] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ id: string; body_md: string; replaced_at: string }> | null>(null);
  const [pending, start] = useTransition();
  const struck = Boolean(entry.struck_at);
  const time = parseISO(entry.occurred_at);

  // refs linked by context (no token in the body) are shown as trailing chips
  const inBody = new Set(Array.from(entry.body_md.matchAll(TOKEN_RE), (m) => m[1].toLowerCase()));
  const contextRefs = entry.refs.filter((r) => !inBody.has(r.ref_code.toLowerCase()) && r.id !== entry.linked?.id);

  function save() {
    const body = draft.trim();
    if (!body) return;
    start(async () => {
      const res = await editEntry({ entryId: entry.id, body });
      if (!res.ok) toast.error(res.error);
      else setEditing(false);
    });
  }
  function toggleStrike() {
    setMenu(false);
    start(async () => {
      const res = await strikeEntry({ entryId: entry.id, struck: !struck });
      if (!res.ok) toast.error(res.error);
    });
  }
  function showHistory() {
    setMenu(false);
    start(async () => {
      const res = await listRevisions({ entryId: entry.id });
      if (!res.ok) toast.error(res.error);
      else setRevisions(res.data);
    });
  }

  return (
    <article id={entry.id} className={cn("group relative flex scroll-mt-14 gap-2.5 px-2.5", compact ? "py-1.5" : "py-2", struck && "opacity-60")}>
      <div className="w-10 flex-none pt-px text-right font-mono text-[10.5px] text-ink-4">{format(time, "HH:mm")}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-1">
          {entry.type !== "note" && <Tone color={TYPE_TONE[entry.type]}>{entry.type}</Tone>}
          <LinkedChips entry={entry} slug={slug} />
          {entry.edited_at && (
            <button onClick={showHistory} className="text-[10.5px] text-ink-4 hover:text-ink" title="Show previous versions">
              edited
            </button>
          )}
          {struck && <span className="text-[10.5px] text-ink-4">struck</span>}
        </div>

        {editing ? (
          <div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                if (e.key === "Escape") { setEditing(false); setDraft(entry.body_md); }
              }}
              rows={Math.min(8, Math.max(1, draft.split("\n").length))}
              className="field resize-none"
            />
            <div className="mt-1 flex gap-1.5 text-[11.5px]">
              <button onClick={save} disabled={pending} className="rounded-2 border border-ink bg-ink px-2 py-0.5 text-white">Save</button>
              <button onClick={() => { setEditing(false); setDraft(entry.body_md); }} className="rounded-2 border border-line px-2 py-0.5 text-ink-2">Cancel</button>
              <span className="self-center text-ink-4">The previous version is kept.</span>
            </div>
          </div>
        ) : (
          <div className={cn(struck && "line-through decoration-ink-3")}>{renderBody(entry.body_md, { slug })}</div>
        )}

        {contextRefs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {contextRefs.map((r) => (
              <Link key={r.id} href={`/w/${slug}/r/${encodeURIComponent(r.ref_code)}`} className="chip hover:border-accent-bd hover:text-accent">
                #{r.ref_code}
              </Link>
            ))}
          </div>
        )}

        {entry.attachments.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {entry.attachments.map((a) => {
              const isImage = a.kind === "ink" || (a.mime ?? "").startsWith("image/");
              const name = a.file_path.slice(a.file_path.lastIndexOf("/") + 1);
              if (isImage && a.url) {
                return (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2 border border-line bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.kind === "ink" ? "Sketch" : name} className="max-h-48 max-w-full object-contain" loading="lazy" />
                  </a>
                );
              }
              return (
                <a key={a.id} href={a.url ?? "#"} target="_blank" rel="noreferrer" className="chip py-1 hover:border-accent-bd hover:text-accent">
                  <FileText className="h-3 w-3" /> {name}
                  {a.bytes ? <span className="text-ink-4">{Math.round(a.bytes / 1024)} KB</span> : null}
                </a>
              );
            })}
          </div>
        )}

        {revisions && (
          <div className="mt-1.5 rounded-2 border border-line bg-bg-2 p-2 text-[12px]">
            <div className="mb-1 flex items-center justify-between">
              <span className="label">Previous versions</span>
              <button onClick={() => setRevisions(null)} className="text-[11px] text-ink-3 hover:text-ink">close</button>
            </div>
            {revisions.length === 0 ? (
              <p className="text-ink-3">No history.</p>
            ) : (
              revisions.map((r) => (
                <div key={r.id} className="border-t border-line py-1 first:border-t-0">
                  <div className="font-mono text-[10px] text-ink-4">until {format(parseISO(r.replaced_at), "d MMM HH:mm")}</div>
                  <div className="whitespace-pre-wrap text-ink-2">{r.body_md}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {!editing && (
        <div className="relative flex-none self-start">
          <button
            onClick={() => setMenu((m) => !m)}
            className="rounded-2 p-0.5 text-ink-4 opacity-60 hover:bg-bg-2 hover:text-ink group-hover:opacity-100"
            aria-label="Entry actions"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menu && (
            <div className="absolute right-0 top-6 z-20 w-40 rounded-3 border border-line bg-surface py-1 text-[12px] shadow-pop" onMouseLeave={() => setMenu(false)}>
              <MenuItem onClick={() => { setMenu(false); setEditing(true); }} icon={Pencil}>Edit</MenuItem>
              <MenuItem onClick={toggleStrike} icon={struck ? RotateCcw : Strikethrough}>{struck ? "Restore" : "Strike out"}</MenuItem>
              {entry.edited_at && <MenuItem onClick={showHistory} icon={History}>History</MenuItem>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MenuItem({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Pencil; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-ink-2 hover:bg-bg-2 hover:text-ink">
      <Icon className="h-3 w-3 text-ink-4" /> {children}
    </button>
  );
}

/** Status / due / score chips from the Actions, Decisions or Risks row this entry created. */
function LinkedChips({ entry, slug }: { entry: EntryWithUrls; slug: string }) {
  const l = entry.linked;
  if (!l) return null;
  const status = typeof l.props.status === "string" ? l.props.status : null;
  const due = typeof l.props.due === "string" ? l.props.due : null;
  const score = riskScore(l.props);
  const done = status === "done" || status === "closed" || status === "approved" || status === "rejected";
  let dueTone: "grey" | "amber" | "red" = "grey";
  if (due && !done) {
    const d = parseISO(due);
    if (isToday(d)) dueTone = "amber";
    else if (isPast(d)) dueTone = "red";
  }
  return (
    <>
      <Link href={`/w/${slug}/r/${encodeURIComponent(l.ref_code)}`} className="chip hover:border-accent-bd hover:text-accent">
        #{l.ref_code}
      </Link>
      {status && <Tone color={done ? "green" : "grey"}>{status}</Tone>}
      {due && <Tone color={dueTone}>due {format(parseISO(due), "d MMM")}</Tone>}
      {score !== null && <Tone color={score >= 12 ? "red" : score >= 6 ? "amber" : "grey"}>p{l.props.probability as number}·i{l.props.impact as number} = {score}</Tone>}
    </>
  );
}
