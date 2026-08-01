import { normalizeIsraeliPhone } from "@/lib/phone";

/*
 * WhatsApp deep links.
 *
 * Built once here and reused by both the initial send (Phase 5) and the
 * follow-up reminder (Phase 7), so the two can never drift apart in how they
 * format a number or escape a message.
 *
 * wa.me wants the number as digits only in international form, with no plus
 * and no punctuation: 972541234567. normalizeIsraeliPhone does that conversion
 * and refuses anything that is not a valid Israeli number, so a malformed
 * number produces a link with no recipient rather than a link to a wrong one.
 */

export type WhatsAppTarget = {
  url: string;
  /** False when we had no usable number and WhatsApp will ask who to send to. */
  hasRecipient: boolean;
};

/**
 * Opens a plain conversation with the client, with nothing written for them.
 *
 * Separate from buildWhatsAppUrl because the intent is different: that one
 * delivers a quote and always carries a message, this one is the tradesperson
 * wanting a word. Both normalise through the same function, so there is one
 * definition of a valid Israeli number rather than two that drift.
 */
export function buildWhatsAppChatUrl(phone: string | null): WhatsAppTarget {
  const normalized = phone ? normalizeIsraeliPhone(phone) : null;

  // Never guess a recipient. Without a usable number this opens WhatsApp on
  // its contact picker, which is honest; a half-parsed number would open a
  // chat with somebody else entirely.
  if (!normalized) return { url: "https://wa.me/", hasRecipient: false };

  return { url: `https://wa.me/${normalized.wa}`, hasRecipient: true };
}

export function buildWhatsAppUrl(
  phone: string | null,
  message: string,
): WhatsAppTarget {
  const normalized = phone ? normalizeIsraeliPhone(phone) : null;
  const text = encodeURIComponent(message);

  if (!normalized) {
    // Still useful: WhatsApp opens with the message ready and lets the owner
    // pick the contact by hand.
    return { url: `https://wa.me/?text=${text}`, hasRecipient: false };
  }

  return { url: `https://wa.me/${normalized.wa}?text=${text}`, hasRecipient: true };
}

/** First name only — a full legal name in an opening line reads like a bill. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function buildQuoteMessage({
  businessName,
  clientName,
  quoteUrl,
}: {
  businessName: string;
  clientName: string;
  quoteUrl: string;
}): string {
  const greeting = clientName ? `היי ${firstName(clientName)},` : "היי,";

  return [
    `${greeting} כאן ${businessName}.`,
    "",
    "מצורפת הצעת המחיר שהכנתי עבורך:",
    quoteUrl,
    "",
    "אפשר לאשר אותה ישירות מהקישור. אשמח לשמוע מה דעתך.",
  ].join("\n");
}

export function buildReminderMessage({
  businessName,
  clientName,
  quoteUrl,
}: {
  businessName: string;
  clientName: string;
  quoteUrl: string;
}): string {
  const greeting = clientName ? `היי ${firstName(clientName)},` : "היי,";

  return [
    `${greeting} רק תזכורת קצרה לגבי הצעת המחיר ששלחתי:`,
    quoteUrl,
    "",
    "אשמח לדעת אם זה מתאים לך, ואם עלו שאלות אני כאן.",
    "",
    businessName,
  ].join("\n");
}

export function buildIntakeMessage({
  businessName,
  clientName,
  formUrl,
}: {
  businessName: string;
  clientName: string;
  formUrl: string;
}): string {
  const greeting = clientName ? `היי ${firstName(clientName)},` : "היי,";

  return [
    `${greeting} כאן ${businessName}.`,
    "",
    "כדי שאוכל להכין לך הצעת מחיר מדויקת, אשמח אם תענה על כמה שאלות קצרות:",
    formUrl,
    "",
    "זה לוקח פחות מדקה.",
  ].join("\n");
}
