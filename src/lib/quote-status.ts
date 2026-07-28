import type { QuoteStatus } from "@/lib/types";

/**
 * The owner never sees the raw enum value. Colours carry meaning:
 * green means money, red means lost, amber means waiting on the client.
 */
export const QUOTE_STATUS: Record<
  QuoteStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "טיוטה",
    className: "bg-background text-muted border-border",
  },
  sent: {
    label: "נשלחה",
    className: "bg-brand-soft text-brand border-brand/20",
  },
  viewed: {
    label: "נצפתה",
    className: "bg-warning-soft text-warning border-warning/20",
  },
  approved: {
    label: "אושרה",
    className: "bg-success-soft text-success border-success/20",
  },
  declined: {
    label: "נדחתה",
    className: "bg-danger-soft text-danger border-danger/20",
  },
  expired: {
    label: "פג תוקף",
    className: "bg-background text-muted border-border",
  },
};
