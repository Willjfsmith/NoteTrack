import { cn } from "@/lib/utils";

export type ToneColor =
  | "yellow"
  | "red"
  | "green"
  | "blue"
  | "purple"
  | "orange"
  | "pink"
  | "grey";

const toneClasses: Record<ToneColor, string> = {
  yellow: "bg-tone-yellow-bg border-tone-yellow-bd text-tone-yellow-ink",
  red: "bg-tone-red-bg border-tone-red-bd text-tone-red-ink",
  green: "bg-tone-green-bg border-tone-green-bd text-tone-green-ink",
  blue: "bg-tone-blue-bg border-tone-blue-bd text-tone-blue-ink",
  purple: "bg-tone-purple-bg border-tone-purple-bd text-tone-purple-ink",
  orange: "bg-tone-orange-bg border-tone-orange-bd text-tone-orange-ink",
  pink: "bg-tone-pink-bg border-tone-pink-bd text-tone-pink-ink",
  grey: "bg-tone-grey-bg border-tone-grey-bd text-tone-grey-ink",
};

export function Tone({
  color,
  square = false,
  large = false,
  className,
  children,
}: {
  color: ToneColor;
  square?: boolean;
  large?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border font-medium leading-tight",
        large ? "px-2 py-0.5 text-[12px]" : "px-1.5 py-px text-[11px]",
        square
          ? "rounded-1 font-mono uppercase tracking-wider text-[10px] font-semibold px-1.5"
          : "rounded-full",
        toneClasses[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
