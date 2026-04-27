import { SkeletonRegister } from "@/components/skeletons";
export default function Loading() {
  return (
    <div className="-mx-[22px] -mt-[18px] -mb-[60px] h-[calc(100vh-49px-18px-60px)]">
      <SkeletonRegister />
    </div>
  );
}
