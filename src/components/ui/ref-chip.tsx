import Link from "next/link";
import { cn } from "@/lib/utils";

export function RefChip({
  refId,
  href,
  className,
}: {
  refId: string;
  href?: string;
  className?: string;
}) {
  const cls = cn(
    "inline-flex items-center rounded-1 border border-line bg-bg-2 px-1 font-mono text-[11.5px] text-ink-2 no-underline transition-colors",
    "hover:border-accent-bd hover:bg-accent-bg hover:text-accent",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        #{refId}
      </Link>
    );
  }
  return <span className={cls}>#{refId}</span>;
}
