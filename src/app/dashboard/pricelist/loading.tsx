import { SkeletonForm } from "@/components/ui/skeleton";

/* The add form is the first thing on this screen, so it is what the
   placeholder stands in for. */
export default function PriceListLoading() {
  return <SkeletonForm fields={2} subtitle />;
}
