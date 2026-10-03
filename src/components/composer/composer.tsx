"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, PenLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { Tone } from "@/components/ui/tone";
import { TYPE_TONE } from "@/lib/entry-tones";
import { parseComposer } from "@/lib/composer/parse";
import { createEntry } from "@/lib/entries/mutations";
import { recordAttachment } from "@/lib/attachments/mutations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { InkCanvas, type InkData } from "@/components/ink/ink-canvas";


type Suggestion = { kind: "row" | "person"; label: string; sub?: string; insert: string };

export type ComposerContext = {
  workspaceId: string;
  peopleTableId?: string;
  meetingRowId?: string;
  projectRowId?: string;
  linkRowIds?: string[];
};

/**
 * One text box for everything. Enter submits (Shift+Enter for a new line). `#` and `@`
 * autocomplete rows and people. The two icons attach a file or open the sketch canvas;
 * any text in the box becomes the caption of that attachment's entry.
 */
export function Composer({
  ctx,
  placeholder = "Log something… /todo /done /decision /risk /meeting, #ref, @person, due:fri, at:yesterday@14:00",
  autoFocus = false,
  compact = false,
  onCreated,
}: {
  ctx: ComposerContext;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  onCreated?: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ink, setInk] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const parsed = useMemo(() => parseComposer(value), [value]);
  const router = useRouter();

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  // auto-grow
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(240, el.scrollHeight) + "px";
  }, [value]);

  async function maybeFetchSuggestions(text: string, caret: number) {
    const left = text.slice(0, caret);
    const tokenStart = Math.max(left.lastIndexOf(" "), left.lastIndexOf("\n")) + 1;
    const token = left.slice(tokenStart);
    if (token.startsWith("#") && token.length >= 2) {
      const q = token.slice(1);
      let query = supabase
        .from("rows")
        .select("id, ref_code, title, table_id")
        .eq("workspace_id", ctx.workspaceId)
        .is("archived_at", null)
        .or(`ref_code.ilike.${q}%,title.ilike.%${q}%`)
        .limit(8);
      if (ctx.peopleTableId) query = query.neq("table_id", ctx.peopleTableId);
      const { data } = await query;
      setSuggestions((data ?? []).map((r) => ({ kind: "row", label: r.ref_code, sub: r.title, insert: `#${r.ref_code}` })));
      setPopoverOpen(true);
      setActiveIdx(0);
      return;
    }
    if (token.startsWith("@") && token.length >= 2 && ctx.peopleTableId) {
      const q = token.slice(1);
      const { data } = await supabase
        .from("rows")
        .select("id, ref_code, title")
        .eq("table_id", ctx.peopleTableId)
        .is("archived_at", null)
        .or(`ref_code.ilike.${q}%,title.ilike.%${q}%`)
        .limit(8);
      const list: Suggestion[] = (data ?? []).map((p) => ({ kind: "person", label: p.ref_code, sub: p.title, insert: `@${p.ref_code}` }));
      if ("me".startsWith(q.toLowerCase())) list.unshift({ kind: "person", label: "me", sub: "you", insert: "@me" });
      setSuggestions(list);
      setPopoverOpen(true);
      setActiveIdx(0);
      return;
    }
    setPopoverOpen(false);
    setSuggestions([]);
  }

  function applySuggestion(s: Suggestion) {
    const el = taRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const left = value.slice(0, caret);
    const tokenStart = Math.max(left.lastIndexOf(" "), left.lastIndexOf("\n")) + 1;
    const right = value.slice(caret);
    const next = value.slice(0, tokenStart) + s.insert + " " + right;
    setValue(next);
    setPopoverOpen(false);
    requestAnimationFrame(() => {
      const c = (value.slice(0, tokenStart) + s.insert + " ").length;
      el.setSelectionRange(c, c);
      el.focus();
    });
  }

  function submit() {
    const raw = value.trim();
    if (!raw || pending) return;
    startTransition(async () => {
      // `at:` is resolved here, on the user's clock, not on the server's.
      const occurredAt = parseComposer(raw).at;
      const res = await createEntry({
        workspaceId: ctx.workspaceId,
        raw,
        meetingRowId: ctx.meetingRowId,
        projectRowId: ctx.projectRowId,
        linkRowIds: ctx.linkRowIds,
        occurredAt,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setValue("");
      setPopoverOpen(false);
      onCreated?.();
      if (res.data.openRef) router.push(`${window.location.pathname.replace(/\/w\/([^/]+).*/, "/w/$1")}/r/${encodeURIComponent(res.data.openRef)}`);
    });
  }

  async function uploadAndRecord(kind: "file" | "ink", path: string, blob: Blob, mime: string, meta?: Record<string, unknown>) {
    const { error } = await supabase.storage.from("attachments").upload(path, blob, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
    const res = await recordAttachment({
      workspaceId: ctx.workspaceId,
      kind,
      filePath: path,
      mime,
      bytes: blob.size,
      meta,
      body: value.trim() || undefined,
      linkRowIds: ctx.linkRowIds,
      projectRowId: ctx.projectRowId,
      meetingRowId: ctx.meetingRowId,
    });
    if (!res.ok) throw new Error(res.error);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${ctx.workspaceId}/files/${Date.now()}-${safe}`;
      setUploading(file.name);
      try {
        await uploadAndRecord("file", path, file, file.type || "application/octet-stream");
        toast.success(`Attached ${file.name}`);
        setValue("");
        onCreated?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleInk(png: Blob, data: InkData) {
    const stamp = Date.now();
    const base = `${ctx.workspaceId}/ink/${stamp}`;
    try {
      const strokesBlob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const { error } = await supabase.storage.from("attachments").upload(`${base}.json`, strokesBlob, { contentType: "application/json" });
      if (error) throw new Error(error.message);
      await uploadAndRecord("ink", `${base}.png`, png, "image/png", { strokes_path: `${base}.json`, width: data.width, height: data.height });
      toast.success("Sketch saved");
      setValue("");
      setInk(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save sketch");
    }
  }

  const busy = pending || uploading !== null;

  return (
    <div className="relative">
      <div className={cn("rounded-3 border border-line bg-surface shadow-1 focus-within:border-line-3", busy && "opacity-60")}>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          disabled={busy}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            maybeFetchSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (popoverOpen && suggestions.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applySuggestion(suggestions[activeIdx]); return; }
              if (e.key === "Escape") { setPopoverOpen(false); return; }
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          className={cn(
            "block w-full resize-none border-none bg-transparent px-2.5 text-[13px] leading-[1.5] text-ink outline-none placeholder:text-ink-4",
            compact ? "py-1.5" : "py-2",
          )}
        />
        <div className="flex items-center gap-1 border-t border-line px-1.5 py-1">
          <Tone color={TYPE_TONE[parsed.type]}>{parsed.type}</Tone>
          {parsed.due && <Tone color="amber">due {parsed.due.slice(5)}</Tone>}
          {(parsed.probability !== undefined || parsed.impact !== undefined) && (
            <Tone color="red">p{parsed.probability ?? "?"}·i{parsed.impact ?? "?"}</Tone>
          )}
          {parsed.status && <Tone>status {parsed.status}</Tone>}
          {parsed.at && <Tone color="amber">at {new Date(parsed.at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</Tone>}
          {uploading && <span className="ml-1 text-[11px] text-ink-3">Uploading {uploading}…</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a file" className="rounded-2 p-1 text-ink-3 hover:bg-bg-2 hover:text-ink">
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setInk(true)} disabled={busy} title="Sketch with the Pencil" className="rounded-2 p-1 text-ink-3 hover:bg-bg-2 hover:text-ink">
            <PenLine className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !value.trim()}
            className="ml-1 inline-flex items-center gap-1.5 rounded-2 border border-ink bg-ink px-2 py-0.5 text-[11.5px] font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving" : "Log"} <Kbd className="border-white/20 bg-white/10 text-white">↵</Kbd>
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      {popoverOpen && suggestions.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-56 overflow-auto rounded-3 border border-line bg-surface shadow-pop">
          {suggestions.map((s, i) => (
            <button
              key={s.kind + s.label + i}
              type="button"
              onClick={() => applySuggestion(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn("flex w-full items-center gap-2 px-2.5 py-1 text-left text-[12.5px]", i === activeIdx && "bg-bg-2")}
            >
              <span className="chip">{s.kind === "row" ? "#" : "@"}{s.label}</span>
              {s.sub && <span className="truncate text-ink-3">{s.sub}</span>}
            </button>
          ))}
        </div>
      )}

      {ink && <InkCanvas onSave={handleInk} onClose={() => setInk(false)} title={value.trim() ? value.trim().slice(0, 60) : "Sketch"} />}
    </div>
  );
}
