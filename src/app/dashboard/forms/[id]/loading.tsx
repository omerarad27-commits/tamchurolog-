import { SkeletonForm } from "@/components/ui/skeleton";

/** Same shape as the "new form" screen: the builder is shared between them. */
export default function EditFormLoading() {
  return <SkeletonForm fields={3} />;
}
