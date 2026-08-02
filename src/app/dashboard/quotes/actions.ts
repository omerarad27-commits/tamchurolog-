"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { defaultChargesVat, toBusinessType } from "@/lib/business-type";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { isQuoteEditable } from "@/lib/types";
import type { FormState } from "@/lib/validation";
import { defaultValidUntil } from "@/lib/quote-defaults";
import { toVatMode, vatFieldsFor, VAT_RATE } from "@/lib/vat";

type SubmittedLine = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
};

type ParsedLine = {
  description: string;
  quantity: number;
  unit_price: number;
};

const MAX_LINES = 60;

/** Accepts "1.5", "1,5" and stray spaces, because owners type on phones. */
function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(",", ".");
  if (cleaned === "") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLines(raw: string): { lines: ParsedLine[] } | { error: string } {
  let submitted: unknown;
  try {
    submitted = JSON.parse(raw);
  } catch {
    return { error: "אירעה שגיאה בקריאת הפריטים. רענן את הדף ונסה שוב." };
  }

  if (!Array.isArray(submitted)) {
    return { error: "אירעה שגיאה בקריאת הפריטים. רענן את הדף ונסה שוב." };
  }
  if (submitted.length > MAX_LINES) {
    return { error: `אפשר להוסיף עד ${MAX_LINES} פריטים בהצעה אחת.` };
  }

  const lines: ParsedLine[] = [];

  for (const entry of submitted as SubmittedLine[]) {
    const description = String(entry?.description ?? "").trim();
    const quantityRaw = entry?.quantity;
    const unitPriceRaw = entry?.unitPrice;

    // Rows the owner started and abandoned are dropped rather than rejected.
    const isBlank =
      description === "" &&
      String(quantityRaw ?? "").trim() === "" &&
      String(unitPriceRaw ?? "").trim() === "";
    if (isBlank) continue;

    if (!description) {
      return { error: "יש למלא תיאור לכל פריט בהצעה." };
    }
    if (description.length > 300) {
      return { error: "תיאור הפריט ארוך מדי (עד 300 תווים)." };
    }

    const quantity = parseNumber(quantityRaw);
    if (quantity === null || quantity <= 0) {
      return { error: `הכמות של "${description}" חייבת להיות מספר גדול מאפס.` };
    }

    const unitPrice = parseNumber(unitPriceRaw);
    if (unitPrice === null || unitPrice < 0) {
      return { error: `המחיר של "${description}" חייב להיות מספר לא שלילי.` };
    }

    lines.push({
      description,
      quantity: Math.round(quantity * 100) / 100,
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  }

  if (lines.length === 0) {
    return { error: "יש להוסיף לפחות פריט אחד להצעה." };
  }

  return { lines };
}

/**
 * A quote is either a list of line items or a single figure with a subject.
 *
 * Both end up in the same column: `lines_total` is the raw amount the owner
 * entered, and a database trigger splits it into subtotal, VAT and total. The
 * only difference is who writes it — the line-item trigger, or this file. So a
 * flat quote is simply a quote with no line items, and nothing that reads a
 * quote needs to learn a new concept.
 */
type Pricing =
  | { kind: "itemized"; lines: ParsedLine[] }
  | { kind: "flat"; amount: number };

const MAX_AMOUNT = 99_999_999;

function parsePricing(formData: FormData): Pricing | { error: string } {
  const title = String(formData.get("title") ?? "").trim();

  if (formData.get("pricingMode") !== "flat") {
    const parsed = parseLines(String(formData.get("lines") ?? "[]"));
    if ("error" in parsed) return { error: parsed.error };
    return { kind: "itemized", lines: parsed.lines };
  }

  /* Without a breakdown, the subject is the only description of the work the
     client gets. An untitled flat quote would be a bare number. */
  if (!title) {
    return { error: "בהצעה בלי פירוט חובה למלא את נושא ההצעה." };
  }

  const amount = parseNumber(formData.get("flatAmount"));
  if (amount === null || amount <= 0) {
    return { error: "יש להזין את סכום ההצעה." };
  }
  if (amount > MAX_AMOUNT) {
    return { error: "הסכום גבוה מדי." };
  }

  return { kind: "flat", amount: Math.round(amount * 100) / 100 };
}

export async function createQuoteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const pricing = parsePricing(formData);
  if ("error" in pricing) return { error: pricing.error, success: null };

  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  /* Optional, and capped to match the check constraint on the column. */
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 80);

  const client = await resolveClient(supabase, business.id, formData);
  if ("error" in client) return { error: client.error, success: null };

  /*
   * quote_number, subtotal, tax_amount and total are all assigned by database
   * triggers. Only the rate is our decision, and it is captured now so the
   * quote keeps the rate it was issued under.
   */
  const withVat = formData.get("withVat") === "on";
  const pricesIncludeVat =
    withVat && formData.get("priceMode") === "inclusive";

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      business_id: business.id,
      client_id: client.clientId,
      title: title || null,
      valid_until: validUntilRaw || null,
      notes: notes || null,
      vat_rate: withVat ? VAT_RATE : 0,
      prices_include_vat: pricesIncludeVat,
      /* On a flat quote nothing else will ever write this: with no line items,
         the recalculation trigger has nothing to fire on. */
      ...(pricing.kind === "flat" ? { lines_total: pricing.amount } : {}),
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return { error: "יצירת ההצעה נכשלה. נסה שוב.", success: null };
  }

  if (pricing.kind === "flat") {
    revalidatePath("/dashboard");
    redirect(`/dashboard/quotes/${quote.id}`);
  }

  const { error: itemsError } = await supabase.from("quote_line_items").insert(
    pricing.lines.map((line, index) => ({
      quote_id: quote.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      sort_order: index,
    })),
  );

  if (itemsError) {
    // Don't leave a totals-less empty quote behind.
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "שמירת הפריטים נכשלה. נסה שוב.", success: null };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/quotes/${quote.id}`);
}

/**
 * Resolves the client for a quote: an existing one, or quick-added inline.
 *
 * Shared by the full builder and the quick route, so "+ new client" means the
 * same thing and validates the same way in both.
 */
async function resolveClient(
  supabase: Awaited<ReturnType<typeof requireBusiness>>["supabase"],
  businessId: string,
  formData: FormData,
): Promise<{ clientId: string } | { error: string }> {
  const submitted = String(formData.get("clientId") ?? "").trim();

  if (submitted !== "__new__") {
    if (!submitted) return { error: "יש לבחור לקוח עבור ההצעה." };
    return { clientId: submitted };
  }

  const fullName = String(formData.get("newClientName") ?? "").trim();
  const phoneInput = String(formData.get("newClientPhone") ?? "").trim();

  if (!fullName) return { error: "יש להזין את שם הלקוח החדש." };

  let phone: string | null = null;
  if (phoneInput) {
    const normalized = normalizeIsraeliPhone(phoneInput);
    if (!normalized) return { error: "מספר הטלפון של הלקוח החדש אינו תקין." };
    phone = normalized.e164;
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ business_id: businessId, full_name: fullName, phone })
    .select("id")
    .single();

  if (error || !created) return { error: "יצירת הלקוח נכשלה. נסה שוב." };

  return { clientId: created.id };
}

/**
 * The quick route: who, what, how much, send.
 *
 * A quote of 350 shekels does not survive a form with line items, quantities,
 * validity dates and terms — the owner writes "350 all in" in WhatsApp instead
 * and the app never gets used. So this writes a perfectly ordinary quote, with
 * everything the form would have asked about taken from the settings the owner
 * already filled in once.
 *
 * The amount is treated as VAT-inclusive when VAT applies, because it is the
 * number said out loud on the phone. Someone quoting from a doorway is saying
 * what the client will pay, not a pre-tax base.
 *
 * It stays a draft here and is marked sent when WhatsApp actually opens, which
 * is the same rule the full route follows.
 */
export async function createQuickQuoteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  if (!title) {
    return { error: "יש לכתוב על מה ההצעה.", success: null };
  }

  const amount = parseNumber(formData.get("amount"));
  if (amount === null || amount <= 0) {
    return { error: "יש להזין סכום.", success: null };
  }
  if (amount > MAX_AMOUNT) {
    return { error: "הסכום גבוה מדי.", success: null };
  }

  const client = await resolveClient(supabase, business.id, formData);
  if ("error" in client) return { error: client.error, success: null };

  /* The business type is the fallback for a form that somehow arrives without
     the field; the owner's choice on the screen is what decides. */
  const vatMode = toVatMode(
    formData.get("vatMode"),
    defaultChargesVat(toBusinessType(business.business_type))
      ? "inclusive"
      : "none",
  );
  const vat = vatFieldsFor(vatMode);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      business_id: business.id,
      client_id: client.clientId,
      title,
      valid_until: defaultValidUntil(),
      notes: business.default_terms ?? null,
      vat_rate: vat.vatRate,
      prices_include_vat: vat.pricesIncludeVat,
      lines_total: Math.round(amount * 100) / 100,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return { error: "יצירת ההצעה נכשלה. נסה שוב.", success: null };
  }

  revalidatePath("/dashboard");
  /* send=1 opens WhatsApp on arrival, so the whole route is one screen and one
     button. See the quote page for how that is handled and what happens when
     the browser declines to follow it. */
  redirect(`/dashboard/quotes/${quote.id}?send=1`);
}

/**
 * Saves changes to an existing quote.
 *
 * The delicate part is not the edit, it is the link already sitting in the
 * client's WhatsApp. If the quote has been sent, that link must stop showing
 * the old numbers the moment they change, so the token is rotated and the old
 * one starts answering "this quote was cancelled". The quote drops back to
 * draft, because what the owner just produced is a version nobody has seen.
 *
 * A draft has no link in anyone's hands, so it keeps its token.
 */
export async function updateQuoteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "ההצעה לא נמצאה.", success: null };

  const { data: existing } = await supabase
    .from("quotes")
    .select("id, status, sent_at")
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!existing) return { error: "ההצעה לא נמצאה.", success: null };

  if (!isQuoteEditable(existing.status)) {
    return {
      error:
        "אי אפשר לערוך הצעה שהלקוח כבר הכריע לגביה. אפשר ליצור הצעה חדשה במקום.",
      success: null,
    };
  }

  const pricing = parsePricing(formData);
  if ("error" in pricing) return { error: pricing.error, success: null };

  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!clientId || clientId === "__new__") {
    // Quick-add is a creation-time convenience; editing uses the client list.
    return { error: "יש לבחור לקוח עבור ההצעה.", success: null };
  }

  const withVat = formData.get("withVat") === "on";

  /*
   * The old line items go first, before the quote row is touched.
   *
   * Their deletion fires the recalculation trigger, which resets lines_total to
   * zero. Doing it after the update below would therefore wipe the amount of a
   * quote the owner just converted to a flat one. With the delete first, the
   * update writes the final word in both modes: the flat amount here, or a
   * value the reinsert further down replaces.
   */
  await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      client_id: clientId,
      title:
        String(formData.get("title") ?? "").trim().slice(0, 80) || null,
      valid_until: String(formData.get("validUntil") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      vat_rate: withVat ? VAT_RATE : 0,
      prices_include_vat:
        withVat && formData.get("priceMode") === "inclusive",
      ...(pricing.kind === "flat" ? { lines_total: pricing.amount } : {}),
    })
    .eq("id", quoteId)
    .eq("business_id", business.id);

  if (updateError) {
    return { error: "שמירת השינויים נכשלה. נסה שוב.", success: null };
  }

  /*
   * Reinstate the line items wholesale. Diffing them would buy nothing: the
   * builder hands back the complete list every time, and the totals trigger
   * recomputes from whatever ends up in the table.
   *
   * A flat quote has none, and skips straight to retiring the old link.
   */
  const { error: itemsError } =
    pricing.kind === "flat"
      ? { error: null }
      : await supabase.from("quote_line_items").insert(
          pricing.lines.map((line, index) => ({
            quote_id: quoteId,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            sort_order: index,
          })),
        );

  if (itemsError) {
    return { error: "שמירת הפריטים נכשלה. נסה שוב.", success: null };
  }

  // Only now, once the new contents are safely stored, retire the old link.
  if (existing.sent_at || existing.status !== "draft") {
    const { error: rotateError } = await supabase.rpc("rotate_quote_token", {
      p_quote_id: quoteId,
    });
    if (rotateError) {
      return {
        error:
          "השינויים נשמרו, אך ביטול הקישור הישן נכשל. רענן ונסה לערוך שוב לפני שליחה.",
        success: null,
      };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/quotes/${quoteId}`);
  redirect(`/dashboard/quotes/${quoteId}`);
}

/**
 * Marks a quote as sent. Called the moment the owner taps the WhatsApp button.
 *
 * Only ever moves a draft forward. A quote that is already sent, viewed,
 * approved or declined is left alone, so re-sharing a link — or sending a
 * Phase 7 reminder — can never reset the history or overwrite sent_at.
 */
export async function markQuoteSentAction(quoteId: string): Promise<void> {
  const { supabase, business } = await requireBusiness();

  await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .eq("status", "draft");

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}

/**
 * Records that a reminder was sent, which restarts the follow-up clock.
 *
 * Never touches status or sent_at: a reminder is a nudge about an existing
 * send, not a new one. Only applies while the quote is still awaiting a
 * decision, so a reminder tapped on an already-approved quote is a no-op.
 */
export async function markQuoteRemindedAction(quoteId: string): Promise<void> {
  const { supabase, business } = await requireBusiness();

  await supabase
    .from("quotes")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("business_id", business.id)
    .in("status", ["sent", "viewed"]);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/quotes/${quoteId}`);
}
