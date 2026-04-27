import { SkeletonBoard } from "@/components/skeletons";
export default function Loading() {
  return (
    <div className="h-[calc(100vh-49px-18px-60px)]">
      <div className="mb-3 h-10 animate-pulse rounded-3 bg-bg-3" />
      <SkeletonBoard />
    </div>
  );
}
