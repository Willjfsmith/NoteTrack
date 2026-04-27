"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { parseComposer, type EntryType } from "@/lib/composer/parse";
import { createEntry } from "@/lib/composer/create-entry";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const TYPE_LABEL: Record<EntryType, string> = {
  note: "note",
  action: "action",
  decision: "decision",
  risk: "risk",
  call: "call",
};

const TYPE_TONE: Record<EntryType, string> = {
  note: "border-line text-ink-3 bg-bg-2",
  action: "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink",
  decision: "border-tone-purple-bd bg-tone-purple-bg text-tone-purple-ink",
  risk: "border-tone-red-bd bg-tone-red-bg text-tone-red-ink",
  call: "border-tone-orange-bd bg-tone-orange-bg text-tone-orange-ink",
};

type Suggestion = { kind: "item" | "person"; label: string; sub?: string; insert: string };

export function Composer({
  projectId,
  meetingId,
  onCreated,
  placeholder = "Log something — start with /note, /todo, /done, /decision, /risk, /call…",
  autoFocus = false,
}: {
  projectId: string;
  meetingId?: string;
  onCreated?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const parsed = useMemo(() => parseComposer(value), [value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /** Examine the cursor's surrounding token to decide whether to show a popover. */
  async function maybeFetchSuggestions(text: string, caret: number) {
    const left = text.slice(0, caret);
    // last whitespace boundary
    const tokenStart = Math.max(left.lastIndexOf(" "), left.lastIndexOf("\n")) + 1;
    const token = left.slice(tokenStart);
    if (token.startsWith("#") && token.length >= 2) {
      const q = token.slice(1);
      const { data } = await supabase
        .from("items")
        .select("id, ref_code, title, kind")
        .eq("project_id", projectId)
        .or(`ref_code.ilike.${q}%,title.ilike.%${q}%`)
        .limit(8);
      setSuggestions(
        (data ?? []).map((it) => ({
          kind: "item",
          label: it.ref_code,
          sub: it.title,
          insert: `#${it.ref_code}`,
        })),
      );
      setPopoverOpen(true);
      setActiveIdx(0);
      return;
    }
    if (token.startsWith("@") && token.length >= 2) {
      const q = token.slice(1);
      const { data } = await supabase
        .from("people")
        .select("id, short_id, name, role_label")
        .eq("project_id", projectId)
        .or(`short_id.ilike.${q}%,name.ilike.%${q}%`)
        .limit(8);
      setSuggestions(
        (data ?? []).map((p) => ({
          kind: "person",
          label: p.short_id,
          sub: p.name + (p.role_label ? ` · ${p.role_label}` : ""),
          insert: `@${p.short_id}`,
        })),
      );
      setPopoverOpen(true);
      setActiveIdx(0);
      return;
    }
    setPopoverOpen(false);
    setSuggestions([]);
  }

  function applySuggestion(s: Suggestion) {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const left = value.slice(0, caret);
    const tokenStart = Math.max(left.lastIndexOf(" "), left.lastIndexOf("\n")) + 1;
    const right = value.slice(caret);
    const next = value.slice(0, tokenStart) + s.insert + " " + right;
    setValue(next);
    setPopoverOpen(false);
    requestAnimationFrame(() => {
      const newCaret = (value.slice(0, tokenStart) + s.insert + " ").length;
      el.setSelectionRange(newCaret, newCaret);
      el.focus();
    });
  }

  function submit() {
    const raw = value.trim();
    if (!raw || pending) return;
    startTransition(async () => {
      const res = await createEntry({ projectId, raw, meetingId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Logged ${res.entry.type}.`);
      setValue("");
      setPopoverOpen(false);
      onCreated?.();
    });
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-4 border border-line bg-surface p-3 shadow-1",
          pending && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            maybeFetchSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (popoverOpen && suggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                applySuggestion(suggestions[activeIdx]);
                return;
              }
              if (e.key === "Escape") {
                setPopoverOpen(false);
                return;
              }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="flex-1 border-none bg-transparent px-1 py-1.5 text-[14px] text-ink outline-none placeholder:text-ink-3"
          disabled={pending}
        />
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              TYPE_TONE[parsed.type],
            )}
          >
            {TYPE_LABEL[parsed.type]}
          </span>
          {parsed.due && (
            <span className="rounded-full border border-line bg-bg-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-3">
              due {parsed.due.slice(5)}
            </span>
          )}
          {(parsed.probability !== undefined || parsed.impact !== undefined) && (
            <span className="rounded-full border border-tone-red-bd bg-tone-red-bg px-2 py-0.5 font-mono text-[10.5px] text-tone-red-ink">
              p{parsed.probability ?? "?"}·i{parsed.impact ?? "?"}
            </span>
          )}
          <button
            onClick={submit}
            disabled={pending || !value.trim()}
            className="ml-1 rounded-2 border border-accent-bd bg-accent px-2 py-1 text-[11.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="mr-1">{pending ? "Saving" : "Submit"}</span>
            <Kbd className="bg-white/15 text-white">⌘↵</Kbd>
          </button>
        </div>
      </div>

      {popoverOpen && suggestions.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-60 overflow-auto rounded-3 border border-line bg-surface shadow-pop">
          {suggestions.map((s, i) => (
            <button
              key={s.kind + s.label + i}
              type="button"
              onClick={() => applySuggestion(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px]",
                i === activeIdx ? "bg-bg-2" : "",
              )}
            >
              <span
                className={cn(
                  "rounded-1 border px-1 font-mono text-[10.5px]",
                  s.kind === "item"
                    ? "border-tone-blue-bd bg-tone-blue-bg text-tone-blue-ink"
                    : "border-tone-pink-bd bg-tone-pink-bg text-tone-pink-ink",
                )}
              >
                {s.kind === "item" ? "#" : "@"}
                {s.label}
              </span>
              {s.sub && <span className="truncate text-ink-3">{s.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
