/*
 * Israeli phone number handling.
 *
 * Owners type numbers however they like: 054-1234567, 054 123 4567,
 * +972-54-1234567, 00972541234567. All of those must end up as the same
 * canonical number, because Phase 5 builds wa.me links from it and WhatsApp
 * only accepts international format with no punctuation.
 */

/** Mobile prefixes are 9 digits after the leading zero, landlines are 8. */
const MOBILE_PREFIXES = ["5", "7"];
const LANDLINE_PREFIXES = ["2", "3", "4", "8", "9"];

export type NormalizedPhone = {
  /** Digits only, international, no plus: 972541234567. This is what wa.me wants. */
  wa: string;
  /** E.164 for storage and display: +972541234567 */
  e164: string;
  /** Local Israeli form for humans: 054-1234567 */
  local: string;
};

/**
 * Reduces any accepted spelling of an Israeli number to its national part
 * (no country code, no leading zero), or null if it cannot be one.
 */
function toNationalDigits(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("972")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^\d+$/.test(digits)) return null;

  const prefix = digits.slice(0, 1);

  if (MOBILE_PREFIXES.includes(prefix) && digits.length === 9) return digits;
  if (LANDLINE_PREFIXES.includes(prefix) && digits.length === 8) return digits;

  return null;
}

/** Returns every useful representation of the number, or null if invalid. */
export function normalizeIsraeliPhone(input: string): NormalizedPhone | null {
  const national = toNationalDigits(input);
  if (!national) return null;

  const isMobile = MOBILE_PREFIXES.includes(national.slice(0, 1));
  const local = isMobile
    ? `0${national.slice(0, 2)}-${national.slice(2)}`
    : `0${national.slice(0, 1)}-${national.slice(1)}`;

  return {
    wa: `972${national}`,
    e164: `+972${national}`,
    local,
  };
}

export function isValidIsraeliPhone(input: string): boolean {
  return normalizeIsraeliPhone(input) !== null;
}

/** Falls back to the raw value so we never hide data we failed to parse. */
export function formatPhoneForDisplay(input: string | null): string {
  if (!input) return "";
  return normalizeIsraeliPhone(input)?.local ?? input;
}
