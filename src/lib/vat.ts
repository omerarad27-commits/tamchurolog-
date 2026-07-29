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

export type VatBreakdown = {
  /** Always the amount before VAT. */
  subtotal: number;
  /** Always the VAT itself. */
  vat: number;
  /** Always what the client pays. */
  total: number;
};

/**
 * Splits the sum of the line items into the three figures shown everywhere.
 *
 * Mirrors apply_quote_money() in the database exactly, including the rounding.
 * The database is what gets stored; this exists so the builder can show the
 * same numbers live, before anything is saved. If the two ever disagree, the
 * owner sees one total while typing and a different one after saving.
 */
export function splitVat(
  linesTotal: number,
  rate: number,
  pricesIncludeVat: boolean,
): VatBreakdown {
  const round = (value: number) => Math.round(value * 100) / 100;
  const lines = round(linesTotal);

  if (rate === 0) {
    return { subtotal: lines, vat: 0, total: lines };
  }

  if (pricesIncludeVat) {
    // VAT by subtraction, so the three always reconcile to the agora.
    const subtotal = round(lines / (1 + rate));
    return { subtotal, vat: round(lines - subtotal), total: lines };
  }

  const vat = round(lines * rate);
  return { subtotal: lines, vat, total: round(lines + vat) };
}
