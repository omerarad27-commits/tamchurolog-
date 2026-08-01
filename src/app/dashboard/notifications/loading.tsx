import { SkeletonList } from "@/components/ui/skeleton";

/** Mirrors the notifications list: a title and rows, no "new" action and no filters. */
export default function NotificationsLoading() {
  return <SkeletonList rows={5} />;
}
