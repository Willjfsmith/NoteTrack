import { SkeletonDiary } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-5 h-32 animate-pulse rounded-3 bg-bg-3" />
        <div className="mb-5 h-12 animate-pulse rounded-4 bg-bg-3" />
        <SkeletonDiary />
      </div>
      <aside className="h-40 animate-pulse rounded-4 bg-bg-3" />
    </div>
  );
}
