import { QUOTE_STATUS } from "@/lib/quote-status";
import type { QuoteStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const { label, className } = QUOTE_STATUS[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
