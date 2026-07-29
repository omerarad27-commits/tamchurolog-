/*
 * Business type, and what follows from it.
 *
 * The only thing the app derives from it today is whether a new quote starts
 * with VAT switched on. That single default is the whole point: an exempt
 * business may not charge VAT, and one that has to remember to turn it off on
 * every quote will eventually forget.
 */

export const BUSINESS_TYPES = ["exempt", "licensed", "company"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<
  BusinessType,
  { label: string; hint: string }
> = {
  exempt: {
    label: "עוסק פטור",
    hint: "לא גובה מע״מ",
  },
  licensed: {
    label: "עוסק מורשה",
    hint: "גובה מע״מ",
  },
  company: {
    label: "חברה בע״מ",
    hint: "גובה מע״מ",
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" &&
    (BUSINESS_TYPES as readonly string[]).includes(value)
  );
}

/** Anything unrecognised is treated as licensed, matching the database default. */
export function toBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : "licensed";
}

/** An exempt business is not permitted to charge VAT, so quotes start without it. */
export function defaultChargesVat(type: BusinessType): boolean {
  return type !== "exempt";
}
