"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Result =
  | { kind: "item"; id: string; label: string; sub: string; href: string }
  | { kind: "person"; id: string; label: string; sub: string; href: string }
  | { kind: "entry"; id: string; label: string; sub: string; href: string };

const NAV: Array<{ label: string; sub: string; key: string }> = [
  { label: "Today", sub: "/today", key: "today" },
  { label: "Pipelines", sub: "/pipelines", key: "pipelines" },
  { label: "Actions", sub: "/actions", key: "actions" },
  { label: "Risks", sub: "/risks", key: "risks" },
  { label: "Watching", sub: "/watching", key: "watching" },
  { label: "Library", sub: "/library", key: "library" },
  { label: "People", sub: "/people", key: "people" },
  { label: "Meetings", sub: "/meetings", key: "meetings" },
];

export function CommandPalette({
  projectId,
  projectCode,
}: {
  projectId: string;
  projectCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setResults(
        NAV.map((n) => ({
          kind: "item" as const,
          id: n.key,
          label: n.label,
          sub: n.sub,
          href: `/p/${projectCode}${n.sub}`,
        })),
      );
      return;
    }
    let cancelled = false;
    async function search() {
      const term = q.trim();
      const [items, people, entries] = await Promise.all([
        supabase
          .from("items")
          .select("id, ref_code, title, item_type:type_id ( key )")
          .eq("project_id", projectId)
          .or(`ref_code.ilike.%${term}%,title.ilike.%${term}%`)
          .limit(8),
        supabase
          .from("people")
          .select("id, short_id, name, role_label")
          .eq("project_id", projectId)
          .or(`short_id.ilike.%${term}%,name.ilike.%${term}%`)
          .limit(6),
        supabase
          .from("entries")
          .select("id, body_md, occurred_at, entry_type:entry_type_id ( key )")
          .eq("project_id", projectId)
          .ilike("body_md", `%${term}%`)
          .order("occurred_at", { ascending: false })
          .limit(8),
      ]);

      if (cancelled) return;

      const out: Result[] = [];
      type ItemRow = {
        id: string;
        ref_code: string;
        title: string;
        item_type: { key: string } | { key: string }[] | null;
      };
      for (const it of (items.data ?? []) as ItemRow[]) {
        const itype = Array.isArray(it.item_type) ? it.item_type[0] : it.item_type;
        out.push({
          kind: "item",
          id: it.id,
          label: `#${it.ref_code} — ${it.title}`,
          sub: itype?.key ?? "item",
          href: `/p/${projectCode}/items/${it.ref_code}`,
        });
      }
      for (const p of people.data ?? []) {
        out.push({
          kind: "person",
          id: p.id,
          label: p.name,
          sub: `@${p.short_id}${p.role_label ? ` · ${p.role_label}` : ""}`,
          href: `/p/${projectCode}/people?p=${encodeURIComponent(p.short_id)}`,
        });
      }
      type EntryRow = {
        id: string;
        body_md: string;
        occurred_at: string;
        entry_type: { key: string } | { key: string }[] | null;
      };
      for (const e of (entries.data ?? []) as EntryRow[]) {
        const et = Array.isArray(e.entry_type) ? e.entry_type[0] : e.entry_type;
        out.push({
          kind: "entry",
          id: e.id,
          label: e.body_md.slice(0, 80),
          sub: `${et?.key ?? "note"} · ${new Date(e.occurred_at).toLocaleString()}`,
          href: `/p/${projectCode}/today`,
        });
      }
      setResults(out);
      setActiveIdx(0);
    }
    const id = setTimeout(search, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, open, projectId, projectCode, supabase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-ink/40 pt-[10vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-4 border border-line bg-surface shadow-pop mx-auto"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => (i + 1) % Math.max(1, results.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => (i - 1 + Math.max(1, results.length)) % Math.max(1, results.length));
              } else if (e.key === "Enter") {
                const r = results[activeIdx];
                if (r) {
                  setOpen(false);
                  router.push(r.href);
                }
              }
            }}
            placeholder="Search items, people, notes…"
            className="flex-1 border-none bg-transparent text-[14px] outline-none placeholder:text-ink-3"
          />
          <span className="font-mono text-[10.5px] text-ink-4">esc to close</span>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {(["item", "person", "entry"] as const).map((kind) => {
            const subset = results.filter((r) => r.kind === kind);
            if (subset.length === 0) return null;
            return (
              <div key={kind}>
                <div className="border-b border-line bg-bg-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-4">
                  {kind === "item" ? "Items" : kind === "person" ? "People" : "Entries"}
                </div>
                {subset.map((r) => {
                  const i = results.indexOf(r);
                  return (
                    <Link
                      key={r.id + r.kind}
                      href={r.href}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 border-b border-line px-3 py-2 text-[13px]",
                        i === activeIdx ? "bg-bg-2" : "",
                      )}
                    >
                      <span className="flex-1 truncate">{r.label}</span>
                      <span className="font-mono text-[10.5px] text-ink-4">{r.sub}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
          {results.length === 0 && (
            <div className="p-6 text-center text-[12.5px] text-ink-3">
              No results — try a different query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
