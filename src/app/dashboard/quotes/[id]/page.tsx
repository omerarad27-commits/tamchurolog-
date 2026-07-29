import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDateTime, formatILS, formatQuantity } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Client, Quote, QuoteLineItem } from "@/lib/types";
import { buildQuoteMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { SendQuote } from "./send-quote";

export const metadata: Metadata = {
  title: "הצעת מחיר | תמחורולוג",
};

export default async function QuotePage({
  params,
}: PageProps<"/dashboard/quotes/[id]">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, public_token, first_viewed_at, last_viewed_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!quoteRow) notFound();
  const quote = quoteRow as Quote;

  const [{ data: clientRow }, { data: itemRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_id, full_name, phone, email, notes, created_at")
      .eq("id", quote.client_id)
      .maybeSingle(),
    supabase
      .from("quote_line_items")
      .select("id, quote_id, description, quantity, unit_price, line_total, sort_order")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true }),
  ]);

  const client = clientRow as Client | null;
  const items = (itemRows ?? []) as QuoteLineItem[];
  const publicUrl = `${publicEnv.appUrl}/q/${quote.public_token}`;

  const whatsapp = buildWhatsAppUrl(
    client?.phone ?? null,
    buildQuoteMessage({
      businessName: business.name,
      clientName: client?.full_name ?? "",
      quoteUrl: publicUrl,
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          ‹ חזרה להצעות
        </Link>

        <div className="mt-2 flex items-center gap-3">
          <h1 className="numeric text-2xl font-bold">
            הצעה #{quote.quote_number}
          </h1>
          <StatusBadge status={quote.status} />
        </div>

        <p className="mt-1 text-sm text-muted">
          נוצרה ב־<span className="numeric">{formatDate(quote.issued_at)}</span>
          {quote.valid_until ? (
            <>
              {" · בתוקף עד "}
              <span className="numeric">{formatDate(quote.valid_until)}</span>
            </>
          ) : null}
        </p>
      </div>

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted">לקוח</h2>
        <p className="mt-1 font-semibold">{client?.full_name ?? "—"}</p>
        {client?.phone ? (
          <p className="numeric text-sm text-muted">
            {formatPhoneForDisplay(client.phone)}
          </p>
        ) : (
          <p className="text-sm text-warning">חסר טלפון</p>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-muted">
          פירוט
        </h2>

        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.description}</p>
                <p className="numeric text-sm text-muted">
                  {formatQuantity(Number(item.quantity))} ×{" "}
                  {formatILS(Number(item.unit_price))}
                </p>
              </div>
              <span className="numeric shrink-0 font-semibold">
                {formatILS(Number(item.line_total))}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="font-semibold">סה״כ</span>
          <span className="numeric text-2xl font-bold">
            {formatILS(Number(quote.total))}
          </span>
        </div>
      </section>

      {quote.notes ? (
        <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted">הערות ותנאים</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {quote.notes}
          </p>
        </section>
      ) : null}

      <SendQuote
        quoteId={quote.id}
        url={whatsapp.url}
        hasRecipient={whatsapp.hasRecipient}
        alreadySent={quote.status !== "draft"}
      />

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted">הקישור ללקוח</h2>
        <p
          dir="ltr"
          className="numeric mt-1.5 rounded-tile bg-background px-3 py-2 text-start text-xs break-all"
        >
          {publicUrl}
        </p>

        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-control w-full items-center justify-center rounded-control border border-border bg-surface text-base font-semibold transition-colors hover:bg-background"
        >
          פתיחת הקישור בלשונית חדשה
        </a>

        <dl className="mt-4 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">נשלחה</dt>
            <dd className="numeric font-medium">
              {quote.sent_at ? formatDateTime(quote.sent_at) : "טרם נשלחה"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">נצפתה לראשונה</dt>
            <dd className="numeric font-medium">
              {quote.first_viewed_at
                ? formatDateTime(quote.first_viewed_at)
                : "טרם נצפתה"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">צפייה אחרונה</dt>
            <dd className="numeric font-medium">
              {quote.last_viewed_at
                ? formatDateTime(quote.last_viewed_at)
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-center text-sm text-muted">
        שליחה בוואטסאפ תתווסף בשלב הבא.
      </p>
    </div>
  );
}
