import { SkeletonList } from "@/components/ui/skeleton";

/** Mirrors the forms list: title, subtitle, "new form" button, a grid of cards. */
export default function FormsLoading() {
  return <SkeletonList rows={4} action subtitle />;
}
