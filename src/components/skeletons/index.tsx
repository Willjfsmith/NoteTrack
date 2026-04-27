import { cn } from "@/lib/utils";

const PULSE = "animate-pulse rounded-2 bg-bg-3";

export function SkeletonText({ className }: { className?: string }) {
  return <div className={cn(PULSE, "h-3 w-full", className)} />;
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-line py-2.5", className)}>
      <div className={cn(PULSE, "h-5 w-12")} />
      <div className={cn(PULSE, "h-4 flex-1")} />
      <div className={cn(PULSE, "h-5 w-5 rounded-full")} />
      <div className={cn(PULSE, "h-3 w-12")} />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3 border border-line bg-surface p-3 shadow-1", className)}>
      <div className={cn(PULSE, "mb-2 h-3 w-3/4")} />
      <div className={cn(PULSE, "mb-1 h-3 w-1/2")} />
      <div className={cn(PULSE, "h-3 w-1/3")} />
    </div>
  );
}

export function SkeletonRegister() {
  return (
    <div className="grid h-full grid-cols-[420px_minmax(0,1fr)] overflow-hidden rounded-4 border border-line bg-bg">
      <div className="flex flex-col gap-2 border-r border-line bg-surface p-3">
        <div className={cn(PULSE, "mb-2 h-6 w-24")} />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      <div className="p-5">
        <SkeletonCard className="mb-4 h-32" />
        <SkeletonCard className="h-48" />
      </div>
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-1">
      {Array.from({ length: 5 }).map((_, c) => (
        <div
          key={c}
          className="flex w-[280px] flex-none flex-col rounded-3 border border-line bg-bg-2 p-2"
        >
          <div className={cn(PULSE, "mb-2 h-5 w-3/4")} />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="mb-1.5 h-16" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDiary() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
