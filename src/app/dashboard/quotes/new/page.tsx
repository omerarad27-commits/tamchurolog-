import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { defaultChargesVat, toBusinessType } from "@/lib/business-type";
import { formatQuantity } from "@/lib/format";
import { defaultValidUntil } from "@/lib/quote-defaults";
import type { Client, PriceListItem } from "@/lib/types";
import { toVatMode, vatFieldsFor } from "@/lib/vat";

import { QuoteBuilder, type QuoteContents } from "../quote-builder";

export const metadata: Metadata = {
  title: "הצעה חדשה | תמחורולוג",
};

/**
 * Reads another quote's contents, for the duplicate button.
 *
 * Scoped to the business on both queries. The id arrives in a query string and
 * is entirely untrusted; a miss returns undefined and the form simply opens
 * blank, which is a better answer than an error page for a link that is almost
 * certainly stale rather than hostile.
 */
async function loadQuoteContents(
  supabase: Awaited<ReturnType<typeof requireBusiness>>["supabase"],
  businessId: string,
  quoteId: string,
): Promise<QuoteContents | undefined> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, title, notes, vat_rate, prices_include_vat, lines_total")
    .eq("id", quoteId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!quote) return undefined;

  const { data: itemRows } = await supabase
    .from("quote_line_items")
    .select("description, quantity, unit_price")
    .eq("quote_id", quote.id)
    .order("sort_order", { ascending: true });

  const items = itemRows ?? [];

  return {
    title: quote.title ?? "",
    notes: quote.notes ?? "",
    withVat: Number(quote.vat_rate) > 0,
    pricesIncludeVat: quote.prices_include_vat,
    /* A quote with no line items was written as a single figure. */
    flatAmount:
      items.length === 0 ? formatQuantity(Number(quote.lines_total)) : "",
    lines: items.map((item) => ({
      description: item.description,
      quantity: formatQuantity(Number(item.quantity)),
      unitPrice: formatQuantity(Number(item.unit_price)),
    })),
  };
}

export default async function NewQuotePage({
  searchParams,
}: PageProps<"/dashboard/quotes/new">) {
  const { supabase, business } = await requireBusiness();

  const [{ data: clientRows }, { data: priceRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_id, full_name, phone, email, notes, created_at")
      .eq("business_id", business.id)
      .order("full_name", { ascending: true }),
    supabase
      .from("price_list_items")
      .select("id, business_id, name, unit_price, sort_order, created_at")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const clients = (clientRows ?? []) as Client[];
  const priceList = (priceRows ?? []) as PriceListItem[];

  /*
   * Arriving from a client's page with that client already chosen.
   *
   * The id is untrusted, but the list above is already scoped to this
   * business, so membership in it is the entire check. An id that is not in it
   * opens the builder with nothing selected rather than raising anything: the
   * owner is one dropdown away from carrying on, and an error page here would
   * be louder than the problem.
   */
  const { clientId } = await searchParams;
  const requested = typeof clientId === "string" ? clientId : undefined;
  const initialClientId = clients.some((client) => client.id === requested)
    ? requested
    : undefined;

  /*
   * Duplicating: ?from=<quote id>.
   *
   * Nothing is written to the database here. The source quote's contents are
   * simply what the form opens with, so an owner who changes their mind and
   * navigates away leaves no half-made draft behind — and a quote the client
   * already approved is never touched, because duplicating is not editing.
   *
   * What is deliberately not carried over: the client, the status, the sent and
   * viewed timestamps, the quote number, and the validity date. The last one is
   * the subtle one — a copy of a quote from March must not arrive already
   * expired, so it takes today's default like any new quote.
   */
  const { from, title, amount, vat } = await searchParams;
  const sourceId = typeof from === "string" ? from : undefined;
  const duplicated = sourceId
    ? await loadQuoteContents(supabase, business.id, sourceId)
    : undefined;

  /*
   * Arriving from the quick screen via "want to itemise?", carrying whatever
   * had been typed there. Nothing is lost by switching routes, which is the
   * only reason that link is safe to offer.
   *
   * An amount with no line items opens the form in flat mode, which is exactly
   * where the quick screen left off: a subject and a price.
   */
  const carried =
    !duplicated && (typeof title === "string" || typeof amount === "string")
      ? {
          title: typeof title === "string" ? title.slice(0, 80) : "",
          notes: business.default_terms ?? "",
          /* Carried from the quick screen, where it was answered explicitly.
             Falling back to the business type here would silently overrule a
             choice the owner had already made one screen earlier. */
          ...(() => {
            const mode = toVatMode(
              vat,
              defaultChargesVat(toBusinessType(business.business_type))
                ? "inclusive"
                : "none",
            );
            const fields = vatFieldsFor(mode);
            return {
              withVat: fields.vatRate > 0,
              pricesIncludeVat: fields.pricesIncludeVat,
            };
          })(),
          flatAmount: typeof amount === "string" ? amount.slice(0, 20) : "",
          lines: [],
        }
      : undefined;

  const prefill = duplicated ?? carried;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="mt-2 text-2xl font-bold">
          {duplicated ? "שכפול הצעה" : "הצעה חדשה"}
        </h1>
        {duplicated ? (
          <p className="mt-1 text-sm text-muted">
            כל הפריטים והתנאים הועתקו. בחר למי לשלוח, ושלח.
          </p>
        ) : null}
      </div>

      <QuoteBuilder
        clients={clients}
        priceList={priceList}
        prefill={prefill}
        initialClientId={initialClientId}
        defaultValidUntil={defaultValidUntil()}
        defaultNotes={business.default_terms ?? ""}
        businessType={toBusinessType(business.business_type)}
        defaultWithVat={defaultChargesVat(toBusinessType(business.business_type))}
      />
    </div>
  );
}
