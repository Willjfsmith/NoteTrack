import { cn } from "@/lib/utils";

/** Compact page header: a label line, a title, and an optional actions slot on the right. */
export function PageHeader({
  label,
  title,
  actions,
  className,
  children,
}: {
  label?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3", className)}>
      <div className="min-w-0">
        {label && <p className="label">{label}</p>}
        <h1 className="mt-0.5 truncate text-[18px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}
