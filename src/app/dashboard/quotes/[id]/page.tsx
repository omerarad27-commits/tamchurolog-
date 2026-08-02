import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDateTime, formatILS, formatQuantity } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone";
import { ButtonLink } from "@/components/ui/button";
import { pickTip } from "@/lib/tips";
import { isQuoteEditable, type Client, type Quote, type QuoteLineItem } from "@/lib/types";
import { formatVatRate } from "@/lib/vat";
import { buildQuoteMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { Tip } from "../../tip";
import { SendQuote } from "./send-quote";

export const metadata: Metadata = {
  title: "הצעת מחיר | תמחורולוג",
};

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/dashboard/quotes/[id]">) {
  const { id } = await params;
  const { send } = await searchParams;
  const { supabase, business } = await requireBusiness();

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, title, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, vat_rate, lines_total, prices_include_vat, public_token, first_viewed_at, last_viewed_at, decision_signature_name, decided_at, decision_reason, created_at, updated_at",
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
  const vatRate = Number(quote.vat_rate);
  const hasVat = vatRate > 0;

  /* Only on a quote the client has already decided: that is the page where the
     owner has nowhere left to go, and the only page this tip makes sense on. */
  const tip = pickTip(
    isQuoteEditable(quote.status) ? [] : ["duplicate"],
    business.dismissed_tips,
  );

  const whatsapp = buildWhatsAppUrl(
    client?.phone ?? null,
    buildQuoteMessage({
      businessName: business.name,
      clientName: client?.full_name ?? "",
      quoteUrl: publicUrl,
      quoteTitle: quote.title,
    }),
  );

  return (
    /* A single quote is a document, like the client's copy of it. Left to
       follow the shell, its line descriptions ended up 1300px from their own
       prices. */
    <div className="flex w-full max-w-form flex-col gap-5">
      <div>

        <div className="mt-2 flex items-center gap-3">
          <h1>
            הצעה <span className="numeric">#{quote.quote_number}</span>
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
          <p className="text-sm text-muted">
            <span className="numeric">{formatPhoneForDisplay(client.phone)}</span>
          </p>
        ) : (
          <p className="text-sm text-warning">חסר טלפון</p>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-muted">
          {items.length > 0 ? "פירוט" : "ההצעה"}
        </h2>

        {/* A quote written as one figure has no breakdown to show. Its subject
            is the whole description, and it is the only thing the client sees
            above the total. */}
        {items.length === 0 ? (
          <p className="px-5 py-3 font-medium">
            {quote.title ?? "הצעה ללא פירוט פריטים"}
          </p>
        ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.description}</p>
                <p className="text-sm text-muted">
                  <span className="numeric">
                    {formatQuantity(Number(item.quantity))}
                  </span>{" "}
                  ×{" "}
                  <span className="numeric">
                    {formatILS(Number(item.unit_price))}
                  </span>
                </p>
              </div>
              <span className="numeric shrink-0 font-semibold">
                {formatILS(Number(item.line_total))}
              </span>
            </li>
          ))}
        </ul>
        )}

        <dl className="flex flex-col gap-1.5 border-t border-border px-5 py-4 text-sm">
          {hasVat ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">סכום לפני מע״מ</dt>
                <dd className="numeric font-medium">
                  {formatILS(Number(quote.subtotal))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">מע״מ {formatVatRate(vatRate)}</dt>
                <dd className="numeric font-medium">
                  {formatILS(Number(quote.tax_amount ?? 0))}
                </dd>
              </div>
            </>
          ) : null}

          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="font-semibold">סה״כ</dt>
            <dd className="numeric text-2xl font-bold">
              {formatILS(Number(quote.total))}
            </dd>
          </div>

          {!hasVat ? (
            <p className="pt-1 text-xs text-muted">ההצעה אינה כוללת מע״מ.</p>
          ) : null}
        </dl>
      </section>

      {quote.notes ? (
        <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted">הערות ותנאים</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {quote.notes}
          </p>
        </section>
      ) : null}

      {quote.status === "approved" ? (
        <section className="rounded-card border border-success/30 bg-success-soft p-5">
          <h2 className="font-bold text-success">הלקוח אישר את ההצעה</h2>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">אושר על ידי</dt>
              <dd className="font-semibold">
                {quote.decision_signature_name ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">מועד האישור</dt>
              <dd className="numeric font-medium">
                {formatDateTime(quote.decided_at)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {quote.status === "declined" ? (
        <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-bold">הלקוח דחה את ההצעה</h2>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">מועד</dt>
              <dd className="numeric font-medium">
                {formatDateTime(quote.decided_at)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">סיבה</dt>
              <dd className="font-medium">
                {quote.decision_reason ?? "לא צוינה"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {/*
        The moment a decided quote is opened is exactly when duplicating is
        worth knowing about: the owner is looking at a page that used to be a
        dead end. Shown once, and only here.
      */}
      {tip === "duplicate" ? (
        <Tip
          id="duplicate"
          action={{
            href: `/dashboard/quotes/new?from=${quote.id}`,
            label: "שכפול ההצעה",
          }}
        >
          אפשר לשכפל את ההצעה הזו ללקוח אחר — כל הפריטים והתנאים עוברים, ורק
          הלקוח והתאריך מתחלפים.
        </Tip>
      ) : null}

      {isQuoteEditable(quote.status) ? (
        <ButtonLink href={`/dashboard/quotes/${quote.id}/edit`} variant="secondary">
          עריכת ההצעה
        </ButtonLink>
      ) : (
        <p className="rounded-tile border border-border bg-background px-3 py-2.5 text-sm text-muted">
          הלקוח כבר הכריע לגבי ההצעה הזו, ולכן היא נעולה לעריכה. אפשר לשכפל אותה
          ללקוח אחר.
        </p>
      )}

      {/*
        Available on every quote, decided ones included — that is where it earns
        its place. An approved quote is the proof that this price works, and
        until now a decided quote was a dead end with no way forward from it.

        It writes nothing: it opens the new-quote form loaded with these
        contents, so the original stays exactly as the client saw it. Duplicating
        is not editing.
      */}
      <ButtonLink
        href={`/dashboard/quotes/new?from=${quote.id}`}
        variant="secondary"
      >
        שכפול ההצעה
      </ButtonLink>

      {/* For the clients who want a file rather than a link — a company, a
          building committee, an accountant. Its own route, so what prints is
          the document and not this workspace. */}
      <ButtonLink
        href={`/dashboard/quotes/${quote.id}/print`}
        variant="secondary"
      >
        שמירה כ־PDF
      </ButtonLink>

      <SendQuote
        quoteId={quote.id}
        url={whatsapp.url}
        hasRecipient={whatsapp.hasRecipient}
        alreadySent={quote.status !== "draft"}
        /* Arriving from the quick route, which owes the owner an open WhatsApp
           window. Only honoured on a draft, so a bookmark or a back button
           carrying the parameter cannot reopen a send that already happened. */
        autoOpen={send === "1" && quote.status === "draft"}
      />

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted">הקישור ללקוח</h2>
        <p
          dir="ltr"
          className="numeric mt-1.5 rounded-tile bg-background px-3 py-2 text-start text-xs break-all"
        >
          {publicUrl}
        </p>

        {/*
          The link only starts working when the quote is sent, so while it is a
          draft this says so instead of offering to open a page that answers
          404. A quote still being priced must not be readable — let alone
          approvable — by anyone who happens to hold the address.
        */}
        {quote.status === "draft" ? (
          <p className="mt-3 rounded-tile border border-border bg-background px-3 py-2.5 text-sm text-muted">
            הקישור עוד לא פעיל. הוא ייפתח ללקוח ברגע שתשלח את ההצעה.
          </p>
        ) : (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-control w-full items-center justify-center rounded-control border border-border bg-surface text-base font-semibold transition-colors hover:bg-background"
          >
            פתיחת הקישור בלשונית חדשה
          </a>
        )}

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
