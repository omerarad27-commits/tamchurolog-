"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { normalizeIsraeliPhone } from "@/lib/phone";
import type { FormState } from "@/lib/validation";
import { VAT_RATE } from "@/lib/vat";

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

export async function createQuoteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const parsed = parseLines(String(formData.get("lines") ?? "[]"));
  if ("error" in parsed) return { error: parsed.error, success: null };

  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  /* Resolve the client: either an existing one, or quick-added inline. */
  let clientId = String(formData.get("clientId") ?? "").trim();

  if (clientId === "__new__") {
    const fullName = String(formData.get("newClientName") ?? "").trim();
    const phoneInput = String(formData.get("newClientPhone") ?? "").trim();

    if (!fullName) {
      return { error: "יש להזין את שם הלקוח החדש.", success: null };
    }

    let phone: string | null = null;
    if (phoneInput) {
      const normalized = normalizeIsraeliPhone(phoneInput);
      if (!normalized) {
        return {
          error: "מספר הטלפון של הלקוח החדש אינו תקין.",
          success: null,
        };
      }
      phone = normalized.e164;
    }

    const { data: created, error: clientError } = await supabase
      .from("clients")
      .insert({ business_id: business.id, full_name: fullName, phone })
      .select("id")
      .single();

    if (clientError || !created) {
      return { error: "יצירת הלקוח נכשלה. נסה שוב.", success: null };
    }
    clientId = created.id;
  }

  if (!clientId) {
    return { error: "יש לבחור לקוח עבור ההצעה.", success: null };
  }

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
      client_id: clientId,
      valid_until: validUntilRaw || null,
      notes: notes || null,
      vat_rate: withVat ? VAT_RATE : 0,
      prices_include_vat: pricesIncludeVat,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return { error: "יצירת ההצעה נכשלה. נסה שוב.", success: null };
  }

  const { error: itemsError } = await supabase.from("quote_line_items").insert(
    parsed.lines.map((line, index) => ({
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
