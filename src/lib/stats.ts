import type { QuoteStatus } from "@/lib/types";

/*
 * Business numbers for the owner.
 *
 * Kept as a pure function over rows rather than SQL aggregates so the maths can
 * be checked against hand-calculated expectations, which is exactly how the
 * spec asks for these to be verified.
 */

export type StatsInput = {
  status: QuoteStatus;
  sent_at: string | null;
  decided_at: string | null;
};

export type QuoteStats = {
  /** Every quote, drafts included. */
  total: number;
  /** Quotes that actually went out. A draft was never sent to anyone. */
  sent: number;
  byStatus: Record<QuoteStatus, number>;
  approved: number;
  declined: number;
  decided: number;
  /**
   * approved / (approved + declined), 0..1.
   * Null when nothing has been decided yet — a close rate of 0% would be a
   * lie in that case, not a fact.
   */
  closeRate: number | null;
  /** Mean hours from send to decision, over quotes that have both. Null if none. */
  averageDecisionHours: number | null;
  /** How many decided quotes the average is actually based on. */
  averageDecisionSample: number;
};

const EMPTY_BY_STATUS: Record<QuoteStatus, number> = {
  draft: 0,
  sent: 0,
  viewed: 0,
  approved: 0,
  declined: 0,
  expired: 0,
};

export function computeQuoteStats(quotes: StatsInput[]): QuoteStats {
  const byStatus = { ...EMPTY_BY_STATUS };
  let sent = 0;
  let decisionHoursTotal = 0;
  let decisionSample = 0;

  for (const quote of quotes) {
    byStatus[quote.status] = (byStatus[quote.status] ?? 0) + 1;

    if (quote.sent_at) sent += 1;

    if (quote.sent_at && quote.decided_at) {
      const elapsed =
        new Date(quote.decided_at).getTime() - new Date(quote.sent_at).getTime();
      // Skip anything nonsensical rather than let it drag the average around.
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        decisionHoursTotal += elapsed / (60 * 60 * 1000);
        decisionSample += 1;
      }
    }
  }

  const approved = byStatus.approved;
  const declined = byStatus.declined;
  const decided = approved + declined;

  return {
    total: quotes.length,
    sent,
    byStatus,
    approved,
    declined,
    decided,
    closeRate: decided === 0 ? null : approved / decided,
    averageDecisionHours:
      decisionSample === 0 ? null : decisionHoursTotal / decisionSample,
    averageDecisionSample: decisionSample,
  };
}

/** "62%" — whole numbers only; a tradesperson does not need decimals here. */
export function formatCloseRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Hours read better below two days, days above. */
export function formatDecisionTime(hours: number | null): string {
  if (hours === null) return "—";

  if (hours < 48) {
    const rounded = Math.round(hours);
    if (rounded === 0) return "פחות משעה";
    if (rounded === 1) return "שעה אחת";
    return `${rounded} שעות`;
  }

  const days = hours / 24;
  const rounded = Math.round(days * 10) / 10;
  return rounded === 1 ? "יום אחד" : `${rounded} ימים`;
}
