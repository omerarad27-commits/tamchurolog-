import { SkeletonList } from "@/components/ui/skeleton";

/** Mirrors the quotes screen: title, "new quote" button, status filters, list. */
export default function DashboardLoading() {
  return <SkeletonList rows={4} action filters={5} />;
}
