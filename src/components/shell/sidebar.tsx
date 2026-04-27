"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Workflow,
  ListTodo,
  AlertTriangle,
  Eye,
  FolderOpen,
  Users,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "today", label: "Today", icon: Home },
  { href: "pipelines", label: "Pipelines", icon: Workflow },
  { href: "actions", label: "Actions", icon: ListTodo },
  { href: "risks", label: "Risks", icon: AlertTriangle },
  { href: "watching", label: "Watching", icon: Eye },
  { href: "library", label: "Library", icon: FolderOpen },
  { href: "people", label: "People", icon: Users },
  { href: "meetings", label: "Meetings", icon: Calendar },
] as const;

export function Sidebar({
  projectCode,
  projectName,
}: {
  projectCode: string;
  projectName: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[240px] flex-col gap-2 overflow-y-auto border-r border-line bg-bg-2 px-2.5 py-3.5">
      <Link href="/select-project" className="mb-2 flex items-center gap-2 px-2 py-1">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-2 bg-ink font-serif text-[14px] font-semibold text-white">
          N
        </span>
        <span className="font-serif text-[18px] font-medium tracking-tight">NoteTrack</span>
      </Link>

      <Link
        href="/select-project"
        className="mb-3 flex items-center gap-2 rounded-3 border border-line bg-surface px-2 py-1.5 text-[12px] hover:border-line-3"
      >
        <span className="h-2.5 w-2.5 rounded-sm bg-tone-yellow-bd" />
        <span className="flex-1 font-medium text-ink">{projectName}</span>
        <span className="text-ink-4">›</span>
      </Link>

      <nav className="flex flex-col">
        {NAV.map(({ href, label, icon: Icon }) => {
          const fullHref = `/p/${projectCode}/${href}`;
          const isActive = pathname?.startsWith(fullHref);
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex items-center gap-2 rounded-2 px-2 py-1.5 text-[13px] leading-tight text-ink-2",
                isActive
                  ? "bg-surface font-medium text-ink shadow-1"
                  : "hover:bg-bg-3",
              )}
            >
              <Icon
                className={cn(
                  "h-[14px] w-[14px]",
                  isActive ? "text-accent" : "text-ink-3",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
