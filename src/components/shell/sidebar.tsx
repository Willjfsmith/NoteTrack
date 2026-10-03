"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BookOpen, Pin, Search, Settings, Table2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

export type NavTable = { slug: string; name: string; views: Array<{ id: string; name: string; pinned?: boolean }> };

export function Sidebar({
  slug,
  name,
  tables,
  role,
}: {
  slug: string;
  name: string;
  tables: NavTable[];
  role: string;
}) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const base = `/w/${slug}`;
  const activeView = search?.get("view");

  const item = (href: string, label: string, Icon: typeof BookOpen, active: boolean) => (
    <Link
      key={href}
      href={href}
      onClick={() => setOpen(false)}
      className={cn(
        "flex items-center gap-2 rounded-2 px-2 py-[5px] text-[12.5px]",
        active ? "bg-bg-3 font-medium text-ink" : "text-ink-2 hover:bg-bg-2 hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5 text-ink-4" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );

  const content = (
    <>
      <Link href="/w" className="mb-3 flex items-center gap-2 px-2">
        <span className="grid h-5 w-5 place-items-center rounded-1 bg-ink font-mono text-[11px] font-semibold text-white">
          N
        </span>
        <span className="truncate text-[13px] font-semibold tracking-tight">{name}</span>
      </Link>

      <nav className="flex flex-col gap-px">
        {item(`${base}/diary`, "Diary", BookOpen, pathname.startsWith(`${base}/diary`))}
        {tables.flatMap((t) =>
          t.views
            .filter((v) => v.pinned)
            .map((v) => item(`${base}/t/${t.slug}?view=${v.id}`, v.name, Pin, pathname === `${base}/t/${t.slug}` && activeView === v.id)),
        )}
        {item(`${base}/search`, "Search", Search, pathname.startsWith(`${base}/search`))}
      </nav>

      <p className="label mb-1 mt-4 px-2">Tables</p>
      <nav className="flex flex-col gap-px">
        {tables.map((t) => {
          const href = `${base}/t/${t.slug}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <div key={t.slug}>
              {item(href, t.name, Table2, active && !activeView)}
              {active && t.views.length > 0 && (
                <div className="ml-4 border-l border-line pl-2">
                  {t.views.map((v) => (
                    <Link
                      key={v.id}
                      href={`${href}?view=${v.id}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block truncate rounded-2 px-2 py-[3px] text-[12px]",
                        activeView === v.id ? "bg-bg-3 text-ink" : "text-ink-3 hover:text-ink",
                      )}
                    >
                      {v.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-px pt-4">
        {role !== "viewer" && item(`${base}/settings`, "Settings", Settings, pathname.startsWith(`${base}/settings`))}
        <div className="hidden items-center gap-1 px-2 pt-2 text-[11px] text-ink-4 md:flex">
          <Kbd>⌘K</Kbd> search &amp; jump
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-10 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
        <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="rounded-2 p-1 hover:bg-bg-2">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <span className="text-[13px] font-semibold">{name}</span>
      </div>
      <div className="h-10 md:hidden" />
      {open && (
        <div className="fixed inset-0 top-10 z-20 bg-overlay md:hidden" onClick={() => setOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[240px] flex-col overflow-y-auto border-r border-line bg-surface px-2 py-3"
          >
            {content}
          </aside>
        </div>
      )}
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[220px] flex-none flex-col overflow-y-auto border-r border-line bg-surface px-2 py-3 md:flex">
        {content}
      </aside>
    </>
  );
}
