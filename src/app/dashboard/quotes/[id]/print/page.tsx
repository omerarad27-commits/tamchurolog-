import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  QuoteDocument,
  quoteFileName,
  type QuoteDocumentData,
} from "@/components/quote-document";
import { SavePdfButton } from "@/components/save-pdf-button";
import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";

import { AutoPrint } from "./auto-print";

export const metadata: Metadata = {
  title: "הצעת מחיר להדפסה | תמחורולוג",
  /* Nothing here belongs in an index, and this route is behind a login anyway.
     Stated rather than assumed, like the public quote page states it. */
  robots: { index: false, follow: false },
};

/**
 * The owner's export: the same document the client sees, with nothing around
 * it.
 *
 * A separate route rather than a print stylesheet over the quote screen,
 * because that screen is a workspace — the client's phone number, the public
 * link, the view timestamps, the send button. None of that belongs on a
 * document going to an accountant, and hiding it piece by piece would leave the
 * next person to add a section deciding whether it prints.
 *
 * It works for a draft too, which the public link deliberately does not: the
 * owner is allowed to look at their own unfinished quote on paper.
 */
export default async function PrintQuotePage({
  params,
}: PageProps<"/dashboard/quotes/[id]/print">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, client_id, quote_number, title, issued_at, valid_until, notes, subtotal, tax_amount, vat_rate, total",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!quote) notFound();

  const [{ data: client }, { data: itemRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("full_name")
      .eq("id", quote.client_id)
      .maybeSingle(),
    supabase
      .from("quote_line_items")
      .select("id, description, quantity, unit_price, line_total")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true }),
  ]);

  const document: QuoteDocumentData = {
    quoteNumber: quote.quote_number,
    title: quote.title,
    issuedAt: quote.issued_at,
    validUntil: quote.valid_until,
    notes: quote.notes,
    subtotal: Number(quote.subtotal),
    taxAmount: Number(quote.tax_amount ?? 0),
    vatRate: Number(quote.vat_rate),
    total: Number(quote.total),
    clientName: client?.full_name ?? "",
    business: {
      name: business.name,
      phone: business.phone,
      logoUrl: business.logo_url,
    },
    items: (itemRows ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
  };

  const fileName = quoteFileName(document);

  return (
    /* Same measure as the client's page, so what the owner exports is the same
       shape as what the client received. */
    <div className="mx-auto flex w-full max-w-document flex-col gap-4">
      <AutoPrint fileName={fileName} />

      <QuoteDocument quote={document} />

      {/* Both hidden on paper. They are here for the case the dialog was
          dismissed, or opened before the logo had loaded. */}
      <SavePdfButton fileName={fileName} />
      <ButtonLink
        href={`/dashboard/quotes/${quote.id}`}
        variant="secondary"
        className="print-hide"
      >
        חזרה להצעה
      </ButtonLink>
    </div>
  );
}
