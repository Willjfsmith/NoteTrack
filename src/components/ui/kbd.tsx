import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded-1 border border-line-2 bg-bg-2 px-1 py-px font-mono text-[10px] leading-none text-ink-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
