/**
 * Defaults a quote is born with, in one place.
 *
 * There are now two routes to a new quote — the full builder and the quick
 * one — and the whole promise of the quick route is that it produces the same
 * quote the long form would have. A validity window that differed between them
 * would be the first thing to drift.
 */

/** Two weeks. The full form lets the owner change it per quote. */
export const DEFAULT_VALIDITY_DAYS = 14;

/** YYYY-MM-DD, which is what both a date input and a date column want. */
export function defaultValidUntil(from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + DEFAULT_VALIDITY_DAYS);
  return date.toISOString().slice(0, 10);
}
