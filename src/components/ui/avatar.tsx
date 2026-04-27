import { cn } from "@/lib/utils";
import type { ToneColor } from "./tone";

const colorClasses: Record<ToneColor, string> = {
  yellow: "bg-tone-yellow-bg border-tone-yellow-bd text-tone-yellow-ink",
  red: "bg-tone-red-bg border-tone-red-bd text-tone-red-ink",
  green: "bg-tone-green-bg border-tone-green-bd text-tone-green-ink",
  blue: "bg-tone-blue-bg border-tone-blue-bd text-tone-blue-ink",
  purple: "bg-tone-purple-bg border-tone-purple-bd text-tone-purple-ink",
  orange: "bg-tone-orange-bg border-tone-orange-bd text-tone-orange-ink",
  pink: "bg-tone-pink-bg border-tone-pink-bd text-tone-pink-ink",
  grey: "bg-bg-3 border-line text-ink-2",
};

export function Avatar({
  initials,
  color = "grey",
  size = "md",
  title,
}: {
  initials: string;
  color?: ToneColor;
  size?: "sm" | "md" | "lg" | "xl";
  title?: string;
}) {
  const sizeCls = {
    sm: "h-[18px] w-[18px] text-[9.5px]",
    md: "h-[22px] w-[22px] text-[10.5px]",
    lg: "h-8 w-8 text-[13px]",
    xl: "h-12 w-12 text-[18px]",
  }[size];

  return (
    <span
      title={title}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full border font-semibold leading-none tracking-tight",
        sizeCls,
        colorClasses[color],
      )}
    >
      {initials}
    </span>
  );
}
