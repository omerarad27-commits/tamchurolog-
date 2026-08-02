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

/**
 * The three things an owner can mean by the number they typed.
 *
 * The database stores this as two fields — a rate and a flag — because that is
 * what the money trigger needs. But two booleans make four states, one of
 * which ("no VAT, and the prices include it") means nothing, and asking
 * someone two questions to express one choice is how the quick screen ended up
 * assuming the answer instead. One value here, expanded to the two columns at
 * the edge.
 */
export type VatMode = "exclusive" | "inclusive" | "none";

/** How a mode is stored. */
export function vatFieldsFor(mode: VatMode): {
  vatRate: number;
  pricesIncludeVat: boolean;
} {
  if (mode === "none") return { vatRate: 0, pricesIncludeVat: false };
  return { vatRate: VAT_RATE, pricesIncludeVat: mode === "inclusive" };
}

/** How a stored quote reads back. */
export function vatModeFrom(
  vatRate: number,
  pricesIncludeVat: boolean,
): VatMode {
  if (vatRate === 0) return "none";
  return pricesIncludeVat ? "inclusive" : "exclusive";
}

/** Narrows an untrusted string — a query parameter, a form field. */
export function toVatMode(value: unknown, fallback: VatMode): VatMode {
  return value === "exclusive" || value === "inclusive" || value === "none"
    ? value
    : fallback;
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
