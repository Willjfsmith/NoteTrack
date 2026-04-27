import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-line border-b-2 bg-bg-3 px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
