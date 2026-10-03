"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { NavTable } from "./sidebar";

type Result = { kind: "nav" | "row" | "entry"; id: string; label: string; sub: string; href: string };

export function CommandPalette({
  workspaceId,
  slug,
  tables,
}: {
  workspaceId: string;
  slug: string;
  tables: NavTable[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const nav: Result[] = useMemo(
    () => [
      { kind: "nav", id: "diary", label: "Diary", sub: "/diary", href: `/w/${slug}/diary` },
      ...tables.map((t) => ({ kind: "nav" as const, id: t.slug, label: t.name, sub: `/t/${t.slug}`, href: `/w/${slug}/t/${t.slug}` })),
      { kind: "nav", id: "search", label: "Search", sub: "/search", href: `/w/${slug}/search` },
      { kind: "nav", id: "settings", label: "Settings", sub: "/settings", href: `/w/${slug}/settings` },
    ],
    [slug, tables],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults(nav);
      setActiveIdx(0);
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("search_workspace", { p_ws: workspaceId, p_q: term, p_limit: 12 });
      if (cancelled) return;
      const hits = (data ?? []) as Array<{ kind: "row" | "entry"; id: string; ref_code: string | null; title: string; snippet: string; occurred_at: string }>;
      const out: Result[] = nav.filter((n) => n.label.toLowerCase().includes(term.toLowerCase()));
      for (const h of hits) {
        if (h.kind === "row" && h.ref_code) {
          out.push({ kind: "row", id: h.id, label: `${h.ref_code} · ${h.title}`, sub: h.snippet, href: `/w/${slug}/r/${encodeURIComponent(h.ref_code)}` });
        } else {
          out.push({ kind: "entry", id: h.id, label: h.snippet.replace(/\*\*/g, ""), sub: `${h.title} · ${new Date(h.occurred_at).toLocaleDateString()}`, href: `/w/${slug}/search?q=${encodeURIComponent(term)}` });
        }
      }
      setResults(out);
      setActiveIdx(0);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, open, nav, supabase, workspaceId, slug]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-overlay pt-[12vh]" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-lg overflow-hidden rounded-3 border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="h-3.5 w-3.5 text-ink-4" />
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
            placeholder="Jump to a table, or search rows and entries…"
            className="flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-ink-4"
          />
          <span className="font-mono text-[10px] text-ink-4">esc</span>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          {results.map((r, i) => (
            <Link
              key={r.kind + r.id}
              href={r.href}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => setOpen(false)}
              className={cn("flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12.5px] last:border-b-0", i === activeIdx && "bg-bg-2")}
            >
              <span className="w-10 flex-none font-mono text-[10px] uppercase text-ink-4">{r.kind}</span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="truncate font-mono text-[10.5px] text-ink-4">{r.sub}</span>
            </Link>
          ))}
          {results.length === 0 && <div className="p-5 text-center text-[12.5px] text-ink-3">No matches.</div>}
        </div>
      </div>
    </div>
  );
}
