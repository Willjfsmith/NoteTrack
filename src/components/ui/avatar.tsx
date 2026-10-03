import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls = {
    sm: "h-[18px] w-[18px] text-[9px]",
    md: "h-[22px] w-[22px] text-[10px]",
    lg: "h-8 w-8 text-[12px]",
  }[size];
  return (
    <span
      title={name}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full border border-line-2 bg-bg-3 font-semibold leading-none tracking-tight text-ink-2",
        sizeCls,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
