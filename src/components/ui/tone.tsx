import { cn } from "@/lib/utils";

/** Monochrome by default; red / amber / green / accent only where meaning demands it. */
export type ToneColor = "grey" | "red" | "amber" | "green" | "accent" | "ink";

const toneClasses: Record<ToneColor, string> = {
  grey: "bg-tone-grey-bg border-tone-grey-bd text-tone-grey-ink",
  red: "bg-tone-red-bg border-tone-red-bd text-tone-red-ink",
  amber: "bg-tone-amber-bg border-tone-amber-bd text-tone-amber-ink",
  green: "bg-tone-green-bg border-tone-green-bd text-tone-green-ink",
  accent: "bg-accent-bg border-accent-bd text-accent",
  ink: "bg-ink border-ink text-white",
};

export function Tone({
  color = "grey",
  mono = true,
  className,
  children,
}: {
  color?: ToneColor;
  /** monospace uppercase label (default) vs. plain text */
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-1 border px-1.5 py-px leading-[16px]",
        mono ? "font-mono text-[10px] font-medium uppercase tracking-[0.05em]" : "text-[11.5px]",
        toneClasses[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
