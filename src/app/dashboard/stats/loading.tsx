import { SkeletonFigures } from "@/components/ui/skeleton";

/** Six figures in the same grid the real summary uses, not a list of rows. */
export default function StatsLoading() {
  return <SkeletonFigures count={6} />;
}
