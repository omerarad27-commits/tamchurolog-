import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { defaultChargesVat, toBusinessType } from "@/lib/business-type";
import { formatQuantity } from "@/lib/format";
import { isQuoteEditable, type Client, type Quote, type QuoteLineItem } from "@/lib/types";

import { QuoteBuilder, type QuoteDraft } from "../../quote-builder";

export const metadata: Metadata = {
  title: "עריכת הצעה | תמחורולוג",
};

export default async function EditQuotePage({
  params,
}: PageProps<"/dashboard/quotes/[id]/edit">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, vat_rate, lines_total, prices_include_vat, public_token, first_viewed_at, last_viewed_at, decision_signature_name, decided_at, decision_reason, reminded_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!quoteRow) notFound();
  const quote = quoteRow as Quote;

  // A decided quote is frozen. Bounce rather than render a form that cannot save.
  if (!isQuoteEditable(quote.status)) {
    redirect(`/dashboard/quotes/${quote.id}`);
  }

  const [{ data: clientRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_id, full_name, phone, email, notes, created_at")
      .eq("business_id", business.id)
      .order("full_name", { ascending: true }),
    supabase
      .from("quote_line_items")
      .select("id, quote_id, description, quantity, unit_price, line_total, sort_order")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true }),
  ]);

  const clients = (clientRows ?? []) as Client[];
  const items = (itemRows ?? []) as QuoteLineItem[];

  const draft: QuoteDraft = {
    id: quote.id,
    clientId: quote.client_id,
    validUntil: quote.valid_until ?? "",
    notes: quote.notes ?? "",
    withVat: Number(quote.vat_rate) > 0,
    pricesIncludeVat: quote.prices_include_vat,
    wasSent: Boolean(quote.sent_at) || quote.status !== "draft",
    lines: items.map((item) => ({
      description: item.description,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatQuantity(Number(item.unit_price)),
    })),
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href={`/dashboard/quotes/${quote.id}`}
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          <span aria-hidden="true">›</span> חזרה להצעה
        </Link>
        <h1 className="numeric mt-2 text-2xl font-bold">
          עריכת הצעה #{quote.quote_number}
        </h1>
      </div>

      <QuoteBuilder
        clients={clients}
        draft={draft}
        defaultValidUntil={draft.validUntil}
        defaultNotes={draft.notes}
        businessType={toBusinessType(business.business_type)}
        defaultWithVat={defaultChargesVat(toBusinessType(business.business_type))}
      />
    </div>
  );
}
