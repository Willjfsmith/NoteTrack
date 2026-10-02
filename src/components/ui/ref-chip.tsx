import Link from "next/link";
import { cn } from "@/lib/utils";

/** `#REF` or `@id` chip. Monochrome; accent on hover so links read as links. */
export function RefChip({
  code,
  href,
  mention = false,
  className,
}: {
  code: string;
  href?: string;
  mention?: boolean;
  className?: string;
}) {
  const cls = cn(
    "inline-flex items-center rounded-1 border border-line bg-bg-2 px-1 font-mono text-[11px] leading-[16px] text-ink-2 no-underline transition-colors",
    href && "hover:border-accent-bd hover:bg-accent-bg hover:text-accent",
    className,
  );
  const label = (mention ? "@" : "#") + code;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return <span className={cls}>{label}</span>;
}
