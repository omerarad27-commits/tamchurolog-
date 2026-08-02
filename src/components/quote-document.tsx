import Image from "next/image";

import {
  formatDate,
  formatILS,
  formatQuantity,
} from "@/lib/format";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { formatVatRate } from "@/lib/vat";

/**
 * The quote as a document: what the client reads, and what comes out of the
 * printer.
 *
 * It exists as one component because there are two places that must show the
 * same thing — the public page and the print route the owner exports from — and
 * "the PDF should look like the page the client sees" is a requirement, not a
 * coincidence. Two copies of this markup would agree on the day they were
 * written and never again.
 *
 * What is deliberately not in here: the approve and decline buttons, the "call
 * us" link, view tracking, and anything else that belongs to the application
 * rather than to the quote. Those are composed around it by the page that wants
 * them, so the printed version cannot inherit them by accident.
 */

export type QuoteDocumentData = {
  quoteNumber: number;
  title: string | null;
  issuedAt: string;
  validUntil: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  vatRate: number;
  total: number;
  clientName: string;
  business: {
    name: string;
    phone: string | null;
    logoUrl: string | null;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

/**
 * The name a saved PDF gets.
 *
 * The browser takes it from the document title, so this is the whole mechanism:
 * client, subject, date, in the order someone looking through a folder of them
 * would want. Slashes are stripped because a date with them in it becomes a
 * directory separator in the download.
 */
export function quoteFileName(quote: QuoteDocumentData): string {
  const parts = [
    quote.clientName,
    quote.title,
    formatDate(quote.issuedAt).replaceAll("/", "."),
  ].filter((part): part is string => Boolean(part && part.trim()));

  return `הצעת מחיר - ${parts.join(" - ")}`;
}

export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  const businessPhone = quote.business.phone
    ? normalizeIsraeliPhone(quote.business.phone)
    : null;

  const hasVat = quote.vatRate > 0;
  /*
   * A quote can be a single headline and a price, with no breakdown at all.
   * Rendering the empty list for it would leave a bordered strip of nothing
   * where a table belongs, which reads as a bug rather than as brevity.
   */
  const isItemized = quote.items.length > 0;

  return (
    <>
      {/* ------------------------------------------------------- business */}
      <header className="flex items-center gap-3">
        {quote.business.logoUrl ? (
          /*
            The largest thing painted above the fold, so it decides the LCP.
            next/image lazy loads by default, which is right almost everywhere
            and wrong here: the client lands on a pricing document and the first
            thing they see is an empty square where the business's logo belongs,
            filled in a moment later.

            eager + high rather than the `priority` prop, which Next 16
            deprecated, and rather than `preload`, which the docs say not to
            combine with fetchPriority.
          */
          <Image
            src={quote.business.logoUrl}
            alt={quote.business.name}
            width={56}
            height={56}
            loading="eager"
            fetchPriority="high"
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
            /* A tel: link on screen, plain digits on paper — a phone number is
               worth printing, the fact that it was clickable is not. */
            <a
              href={`tel:${businessPhone.e164}`}
              className="numeric text-sm text-brand hover:underline"
            >
              {businessPhone.local}
            </a>
          ) : null}
        </div>
      </header>

      {/* ---------------------------------------------------------- quote */}
      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          {/*
            The subject belongs in the h1 rather than under it. A client holding
            three quotes from the same tradesperson gets told which one this is
            by the first line they read, and by the browser tab.

            Quotes written before the field existed have no title, and fall back
            to exactly the heading they have always had.
          */}
          <h1 className="text-2xl font-bold md:text-3xl">
            {quote.title ? `הצעת מחיר עבור ${quote.title}` : "הצעת מחיר"}
          </h1>
          {/* The digits are isolated, the line is not. Putting .numeric on the
              paragraph turned the whole line LTR and left-aligned it under a
              right-aligned title. */}
          <p className="mt-0.5 text-sm text-muted">
            <span className="numeric">#{quote.quoteNumber}</span> ·{" "}
            <span className="numeric">{formatDate(quote.issuedAt)}</span>
          </p>
          {quote.clientName ? (
            <p className="mt-2 text-sm">
              {/* "לכבוד", not "עבור": now that the heading says what the quote
                  is for, the same word cannot also mean who it is for. */}
              <span className="text-muted">לכבוד: </span>
              <span className="font-semibold">{quote.clientName}</span>
            </p>
          ) : null}
        </div>

        {isItemized ? (
          <ul className="divide-y divide-border">
            {quote.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.description}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    <span className="numeric">
                      {formatQuantity(item.quantity)}
                    </span>{" "}
                    ×{" "}
                    <span className="numeric">{formatILS(item.unitPrice)}</span>
                  </p>
                </div>
                <span className="numeric shrink-0 font-semibold">
                  {formatILS(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="flex flex-col gap-2 border-t-2 border-foreground/10 bg-background px-5 py-4">
          {hasVat ? (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">סכום לפני מע״מ</dt>
                <dd className="numeric font-medium">
                  {formatILS(quote.subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted">
                  מע״מ {formatVatRate(quote.vatRate)}
                </dt>
                <dd className="numeric font-medium">
                  {formatILS(quote.taxAmount)}
                </dd>
              </div>
            </>
          ) : null}

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-base font-semibold">סה״כ לתשלום</dt>
            <dd className="numeric text-3xl font-bold">
              {formatILS(quote.total)}
            </dd>
          </div>

          {/* Stated either way. A client comparing two quotes needs to know
              whether they are comparing like with like. */}
          <p className="text-xs text-muted">
            {hasVat
              ? `הסכום כולל מע״מ ${formatVatRate(quote.vatRate)}.`
              : "הסכום אינו כולל מע״מ."}
          </p>
        </dl>
      </section>

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
    </>
  );
}
