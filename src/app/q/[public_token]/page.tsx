import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { clientIpFromHeaders, isLinkPreviewBot } from "@/lib/bots";
import { formatDate, formatDateTime, formatILS, formatQuantity } from "@/lib/format";
import { normalizeIsraeliPhone } from "@/lib/phone";
import {
  isRevokedToken,
  loadPublicQuote,
  recordQuoteView,
} from "@/lib/public-quote";
import { formatVatRate } from "@/lib/vat";

import { QuoteDecision } from "./quote-decision";
import { RevokedQuote } from "./revoked";

export async function generateMetadata({
  params,
}: PageProps<"/q/[public_token]">): Promise<Metadata> {
  const { public_token } = await params;
  const quote = await loadPublicQuote(public_token);

  if (!quote) {
    return { title: "הצעת מחיר", robots: { index: false, follow: false } };
  }

  return {
    title: `הצעת מחיר מ${quote.business.name}`,
    // The amount is deliberately left out of the preview card: these links get
    // pasted into group chats, and the price should only appear once the page
    // is actually opened.
    description: "לחצו לצפייה בפירוט המלא ולאישור ההצעה.",
    // A price quote has no business being indexed by a search engine.
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({
  params,
}: PageProps<"/q/[public_token]">) {
  const { public_token } = await params;
  const quote = await loadPublicQuote(public_token);

  if (!quote) {
    // A link the owner retired by editing, rather than one that never existed.
    if (await isRevokedToken(public_token)) return <RevokedQuote />;
    notFound();
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  // Crawlers still get the page so the WhatsApp preview renders, but their
  // fetch must never count as the client opening the quote.
  if (!isLinkPreviewBot(userAgent)) {
    const ip = clientIpFromHeaders(requestHeaders);
    after(() => recordQuoteView(public_token, ip, userAgent));
  }

  const businessPhone = quote.business.phone
    ? normalizeIsraeliPhone(quote.business.phone)
    : null;

  // Once a client has decided, the buttons are gone for good. The final state
  // is shown instead, so a revisit cannot un-approve anything.
  const isOpen =
    quote.status === "draft" ||
    quote.status === "sent" ||
    quote.status === "viewed";

  const vatRate = Number(quote.vatRate);
  const hasVat = vatRate > 0;

  return (
    /*
      This is the one screen a client sees, and it is a document rather than an
      application. It grows from a phone's full width to a reading measure and
      then stops: max-w-document is 640px, and the page background carries the
      rest of the window. Widening it further would only make the totals travel
      away from the descriptions they belong to.

      More air above and below on a larger screen, so the document sits on the
      page instead of being pinned to the top of the window.
    */
    <main className="mx-auto flex w-full max-w-document flex-1 flex-col gap-4 px-4 py-6 md:gap-5 md:py-12">
      {/* ------------------------------------------------------- business */}
      <header className="flex items-center gap-3">
        {quote.business.logoUrl ? (
          <Image
            src={quote.business.logoUrl}
            alt={quote.business.name}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-tile border border-border bg-surface object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-tile bg-brand text-2xl font-bold text-brand-foreground"
          >
            {quote.business.name.trim().charAt(0) || "ת"}
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{quote.business.name}</p>
          {businessPhone ? (
            <a
              href={`tel:${businessPhone.e164}`}
              className="numeric text-sm text-brand hover:underline"
            >
              {businessPhone.local}
            </a>
          ) : null}
        </div>
      </header>

      {quote.status === "approved" ? (
        <section className="rounded-card border border-success/30 bg-success-soft p-5">
          <h2 className="font-bold text-success">ההצעה אושרה</h2>
          <p className="mt-1 text-sm leading-relaxed">
            תודה! {quote.business.name} ייצור איתך קשר בקרוב.
          </p>
          {quote.decisionName && quote.decidedAt ? (
            <p className="mt-2 text-xs text-muted">
              אושר על ידי{" "}
              <span className="font-semibold text-foreground">
                {quote.decisionName}
              </span>{" "}
              בתאריך{" "}
              <span className="numeric">{formatDateTime(quote.decidedAt)}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      {quote.status === "declined" ? (
        <section className="rounded-card border border-border bg-background p-5">
          <h2 className="font-bold">תודה על התשובה</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            נרשם אצלנו שההצעה אינה רלוונטית. אם תשנה/י את דעתך, אפשר לפנות ישירות
            ל{quote.business.name}.
          </p>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- quote */}
      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h1 className="text-2xl font-bold md:text-3xl">הצעת מחיר</h1>
          {/* The digits are isolated, the line is not. Putting .numeric on the
              paragraph turned the whole line LTR and left-aligned it under a
              right-aligned title. */}
          <p className="mt-0.5 text-sm text-muted">
            <span className="numeric">#{quote.quoteNumber}</span> ·{" "}
            <span className="numeric">{formatDate(quote.issuedAt)}</span>
          </p>
          {quote.clientName ? (
            <p className="mt-2 text-sm">
              <span className="text-muted">עבור: </span>
              <span className="font-semibold">{quote.clientName}</span>
            </p>
          ) : null}
        </div>

        <ul className="divide-y divide-border">
          {quote.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{item.description}</p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="numeric">
                    {formatQuantity(Number(item.quantity))}
                  </span>{" "}
                  ×{" "}
                  <span className="numeric">
                    {formatILS(Number(item.unitPrice))}
                  </span>
                </p>
              </div>
              <span className="numeric shrink-0 font-semibold">
                {formatILS(Number(item.lineTotal))}
              </span>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-2 border-t-2 border-foreground/10 bg-background px-5 py-4">
          {hasVat ? (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">סכום לפני מע״מ</dt>
                <dd className="numeric font-medium">
                  {formatILS(Number(quote.subtotal))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">מע״מ {formatVatRate(vatRate)}</dt>
                <dd className="numeric font-medium">
                  {formatILS(Number(quote.taxAmount ?? 0))}
                </dd>
              </div>
            </>
          ) : null}

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-base font-semibold">סה״כ לתשלום</dt>
            <dd className="numeric text-3xl font-bold">
              {formatILS(Number(quote.total))}
            </dd>
          </div>

          {/* Stated either way. A client comparing two quotes needs to know
              whether they are comparing like with like. */}
          <p className="text-xs text-muted">
            {hasVat
              ? `הסכום כולל מע״מ ${formatVatRate(vatRate)}.`
              : "הסכום אינו כולל מע״מ."}
          </p>
        </dl>
      </section>

      {isOpen ? (
        <QuoteDecision
          token={public_token}
          businessName={quote.business.name}
        />
      ) : null}

      {quote.validUntil ? (
        <p className="text-center text-sm text-muted">
          ההצעה בתוקף עד{" "}
          <span className="numeric font-semibold text-foreground">
            {formatDate(quote.validUntil)}
          </span>
        </p>
      ) : null}

      {quote.notes ? (
        <section className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-muted">תנאים והערות</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
            {quote.notes}
          </p>
        </section>
      ) : null}

      {businessPhone ? (
        <a
          href={`tel:${businessPhone.e164}`}
          className="print-hide inline-flex h-control w-full items-center justify-center rounded-control border border-border bg-surface text-base font-semibold transition-colors hover:bg-background"
        >
          יש שאלה? חייגו ל{quote.business.name}
        </a>
      ) : null}

      <p className="pt-2 text-center text-xs text-muted">
        נשלח באמצעות תמחורולוג
      </p>
    </main>
  );
}
