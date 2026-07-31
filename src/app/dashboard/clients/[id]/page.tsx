import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import { formatPhoneForDisplay, normalizeIsraeliPhone } from "@/lib/phone";
import { SITE_URL } from "@/lib/site";
import type { Client, QuoteStatus } from "@/lib/types";
import { buildWhatsAppChatUrl } from "@/lib/whatsapp";

import { ClientForm } from "../client-form";
import { DeleteClientButton } from "../delete-client-button";
import { SendIntake } from "./send-intake";

export const metadata: Metadata = {
  title: "לקוח | תמחורולוג",
};

/** Only the columns the list actually renders. */
type ClientQuote = {
  id: string;
  quote_number: number;
  status: QuoteStatus;
  total: string;
  issued_at: string;
};

export default async function ClientPage({
  params,
}: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("clients")
    .select("id, business_id, full_name, phone, email, notes, created_at")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) notFound();
  const client = data as Client;

  /*
   * business_id is filtered as well as client_id even though RLS already scopes
   * this table to the owner. It costs nothing, and a query that states its own
   * assumptions does not depend on a policy somewhere else staying correct.
   */
  const { data: quoteRows } = await supabase
    .from("quotes")
    .select("id, quote_number, status, total, issued_at")
    .eq("client_id", client.id)
    .eq("business_id", business.id)
    .order("issued_at", { ascending: false });

  const quotes = (quoteRows ?? []) as ClientQuote[];

  const { data: formRows } = await supabase
    .from("intake_forms")
    .select("id, name")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  // One parse, used by both links. A number that will not normalise gets no
  // buttons at all rather than buttons that reach the wrong person.
  const phone = client.phone ? normalizeIsraeliPhone(client.phone) : null;
  const whatsapp = phone ? buildWhatsAppChatUrl(client.phone) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          <span aria-hidden="true">›</span> חזרה ללקוחות
        </Link>
        <h1 className="mt-2 truncate text-2xl font-bold">{client.full_name}</h1>
        {phone ? (
          // .numeric on the paragraph would turn the whole line LTR and drag
          // it to the left edge under a right-aligned name. Only the digits
          // are isolated.
          <p className="mt-0.5 text-sm text-muted">
            <span className="numeric">
              {formatPhoneForDisplay(client.phone)}
            </span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-warning">חסר טלפון</p>
        )}
      </div>

      {/*
        Two plain anchors, no client component: a tel: and a wa.me link are
        navigations, and on a phone the operating system takes them from here.

        Shown only when the number parses. A disabled button that does not
        explain itself is worse than no button, and the missing-number case
        already says what is wrong right above.
      */}
      {phone && whatsapp ? (
        <div className="flex gap-2">
          <a
            href={whatsapp.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClasses({ variant: "secondary" })} flex-1`}
          >
            וואטסאפ
          </a>
          <a
            href={`tel:${phone.e164}`}
            className={`${buttonClasses({ variant: "secondary" })} flex-1`}
          >
            התקשרות
          </a>
        </div>
      ) : null}

      <ButtonLink href={`/dashboard/quotes/new?clientId=${client.id}`}>
        הצעת מחיר חדשה
      </ButtonLink>

      {/* ------------------------------------------------------- quotes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          הצעות מחיר{" "}
          {quotes.length > 0 ? (
            <span className="numeric font-normal text-muted">
              ({quotes.length})
            </span>
          ) : null}
        </h2>

        {quotes.length === 0 ? (
          <p className="rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">
            עדיין לא יצאה הצעה ללקוח הזה.
          </p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {quotes.map((quote) => (
              <li key={quote.id}>
                <Link
                  href={`/dashboard/quotes/${quote.id}`}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="numeric font-semibold">
                        #{quote.quote_number}
                      </span>
                      <StatusBadge status={quote.status} />
                    </div>
                    {/* Same rule as above: the digits are isolated, the line
                        is not, so the date stays at the start of an RTL row. */}
                    <p className="mt-0.5 text-sm text-muted">
                      <span className="numeric">
                        {formatDate(quote.issued_at)}
                      </span>
                    </p>
                  </div>
                  <span className="numeric shrink-0 font-bold">
                    {formatILS(Number(quote.total))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Editing is demoted rather than removed. It is the rarest thing done on
        this page and it used to occupy all of it.

        <details> rather than a state-driven accordion: no client JavaScript,
        keyboard accessible and announced by a screen reader for free, and this
        page is otherwise a server component.
      */}
      {/* Collapsed by default for the same reason the edit form is: most visits to
          this page are to read a quote, not to send a questionnaire. */}
      <details className="rounded-card border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-4 font-semibold">
          שליחת שאלון
        </summary>
        <div className="border-t border-border p-5">
          <SendIntake
            clientId={client.id}
            clientName={client.full_name}
            clientPhone={client.phone}
            businessName={business.name}
            siteUrl={SITE_URL}
            forms={formRows ?? []}
          />
        </div>
      </details>

      <details className="rounded-card border border-border bg-surface">
        <summary className="cursor-pointer px-5 py-4 font-semibold">
          עריכת פרטי הלקוח
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-5">
          {/* Both receive exactly the props they received before, so the save
              and delete flows are untouched by the move. */}
          <ClientForm client={client} />
          <DeleteClientButton id={client.id} fullName={client.full_name} />
        </div>
      </details>
    </div>
  );
}
