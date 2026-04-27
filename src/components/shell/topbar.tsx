import { Kbd } from "@/components/ui/kbd";

export function TopBar({ crumbs }: { crumbs: string[] }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-line bg-bg/80 px-[18px] py-2.5 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-3">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-4">›</span>}
            <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>{c}</span>
          </span>
        ))}
      </div>
      <div className="flex-1" />
      <button className="flex min-w-[280px] items-center gap-1.5 rounded-3 border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-3 hover:border-line-3">
        <span>Search…</span>
        <span className="ml-auto">
          <Kbd>⌘K</Kbd>
        </span>
      </button>
    </div>
  );
}
