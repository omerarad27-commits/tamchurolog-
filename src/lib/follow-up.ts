import type { QuoteStatus } from "@/lib/types";

/** Only the fields follow-up logic actually depends on. */
export type FollowUpInput = {
  status: QuoteStatus;
  sent_at: string | null;
  reminded_at: string | null;
};

/**
 * A quote is considered cold after this many days of silence.
 *
 * Deliberately a single constant. Three days is a guess, not a finding — the
 * right number will come from watching real tradespeople use this, and when it
 * changes it should change in exactly one place.
 */
export const FOLLOW_UP_AFTER_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The clock runs from the last time the owner reached out, not from the
 * original send. Otherwise a quote chased this morning would still be sitting
 * in the needs-attention list this afternoon.
 */
function lastContactAt(quote: FollowUpInput): string | null {
  return quote.reminded_at ?? quote.sent_at;
}

export function daysSinceLastContact(quote: FollowUpInput): number | null {
  const since = lastContactAt(quote);
  if (!since) return null;

  const elapsed = Date.now() - new Date(since).getTime();
  if (Number.isNaN(elapsed)) return null;

  return Math.floor(elapsed / MS_PER_DAY);
}

/** Sent or viewed, no decision, and quiet for longer than the threshold. */
export function needsFollowUp(quote: FollowUpInput): boolean {
  if (quote.status !== "sent" && quote.status !== "viewed") return false;

  const days = daysSinceLastContact(quote);
  return days !== null && days >= FOLLOW_UP_AFTER_DAYS;
}

/** Short Hebrew phrase for how long a quote has been quiet. */
export function quietForLabel(quote: FollowUpInput): string {
  const days = daysSinceLastContact(quote);
  if (days === null) return "";

  if (quote.reminded_at) {
    if (days === 0) return "נשלחה תזכורת היום";
    if (days === 1) return "תזכורת אחרונה אתמול";
    return `תזכורת אחרונה לפני ${days} ימים`;
  }

  if (days === 0) return "נשלחה היום";
  if (days === 1) return "נשלחה אתמול";
  return `נשלחה לפני ${days} ימים`;
}
