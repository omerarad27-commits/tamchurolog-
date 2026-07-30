import { SkeletonList } from "@/components/ui/skeleton";

export default function ClientsLoading() {
  return <SkeletonList rows={6} action />;
}
