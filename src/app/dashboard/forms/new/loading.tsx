import { SkeletonForm } from "@/components/ui/skeleton";

/** Mirrors the form builder: title, then the name field and the question sections. */
export default function NewFormLoading() {
  return <SkeletonForm fields={3} />;
}
