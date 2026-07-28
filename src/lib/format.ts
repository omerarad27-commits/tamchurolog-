/*
 * Formatting helpers.
 *
 * Everything here is deterministic and timezone-pinned on purpose: these run on
 * the server during render and again in the browser during hydration, and any
 * difference between the two produces a hydration mismatch.
 */

/** ILS with thousands separators: 1234.5 -> ₪1,234.50 */
export function formatILS(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const [whole, fraction] = Math.abs(safe).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = safe < 0 ? "-" : "";
  return `${sign}₪${grouped}.${fraction}`;
}

/** Quantities read better without trailing zeros: 2.00 -> 2, 1.50 -> 1.5 */
export function formatQuantity(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return String(Number(safe.toFixed(2)));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** DD/MM/YYYY in Israel time, regardless of where the server runs. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** DD/MM/YYYY, HH:MM in Israel time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormatter.format(date);
}

/** Value for a date input, which always wants YYYY-MM-DD. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
