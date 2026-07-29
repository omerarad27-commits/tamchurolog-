/*
 * Israeli VAT.
 *
 * 18 percent since 1 January 2025. The rate lives here as the value offered to
 * new quotes; each quote stores the rate it was created with, so a change in
 * the law never rewrites what a client was already shown.
 */

export const VAT_RATE = 0.18;

/** "18%" for labels. */
export function formatVatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Rounded to agorot the same way the database rounds it. */
export function vatAmount(subtotal: number, rate: number): number {
  return Math.round(subtotal * rate * 100) / 100;
}
