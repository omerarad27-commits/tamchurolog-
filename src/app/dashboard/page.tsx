import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import {
  FOLLOW_UP_AFTER_DAYS,
  needsFollowUp,
  quietForLabel,
} from "@/lib/follow-up";
import { formatDate, formatILS } from "@/lib/format";
import type { QuoteWithClient } from "@/lib/types";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { SendReminder } from "./send-reminder";

export const metadata: Metadata = {
  title: "הצעות מחיר | תמחורולוג",
};

const FILTERS = [
  { key: "all", label: "הכל" },
  { key: "draft", label: "טיוטות" },
  { key: "open", label: "ממתינות" },
  { key: "approved", label: "אושרו" },
  { key: "declined", label: "נדחו" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matchesFilter(quote: QuoteWithClient, filter: FilterKey): boolean {
  switch (filter) {
    case "draft":
      return quote.status === "draft";
    case "open":
      return quote.status === "sent" || quote.status === "viewed";
    case "approved":
      return quote.status === "approved";
    case "declined":
      return quote.status === "declined";
    default:
      return true;
  }
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const { supabase, business } = await requireBusiness();
  const { filter } = await searchParams;

  const activeFilter: FilterKey =
    FILTERS.some((f) => f.key === filter) ? (filter as FilterKey) : "all";

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, public_token, first_viewed_at, last_viewed_at, decision_signature_name, decided_at, decision_reason, reminded_at, created_at, updated_at, clients (id, full_name, phone)",
    )
    .eq("business_id", business.id)
    .order("quote_number", { ascending: false });

  const quotes = (data ?? []) as unknown as QuoteWithClient[];
  const coldQuotes = quotes.filter(needsFollowUp);
  const visibleQuotes = quotes.filter((q) => matchesFilter(q, activeFilter));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1>הצעות מחיר</h1>
        <ButtonLink href="/dashboard/quotes/new" size="sm">
          הצעה חדשה
        </ButtonLink>
      </div>

      {error ? (
        <p className="rounded-tile border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          טעינת ההצעות נכשלה. רענן את הדף ונסה שוב.
        </p>
      ) : null}

      {/* Cold quotes come first: this section is the reason the app exists. */}
      {activeFilter === "all" && coldQuotes.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="lg:col-span-2">
            <h2 className="font-bold text-warning">
              צריך מעקב ({coldQuotes.length})
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              הצעות שנשלחו ואין עליהן תשובה כבר {FOLLOW_UP_AFTER_DAYS} ימים או
              יותר.
            </p>
          </div>

          {coldQuotes.map((quote) => {
            const publicUrl = `${publicEnv.appUrl}/q/${quote.public_token}`;
            const reminder = buildWhatsAppUrl(
              quote.clients?.phone ?? null,
              buildReminderMessage({
                businessName: business.name,
                clientName: quote.clients?.full_name ?? "",
                quoteUrl: publicUrl,
              }),
            );

            return (
              <div
                key={quote.id}
                className="flex flex-col gap-3 rounded-tile border border-border bg-surface p-4"
              >
                <Link href={`/dashboard/quotes/${quote.id}`} className="block">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold">
                      {quote.clients?.full_name ?? "לקוח שנמחק"}
                    </p>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted">
                    <span className="numeric">{quietForLabel(quote)}</span>
                    <span className="numeric font-bold text-foreground">
                      {formatILS(Number(quote.total))}
                    </span>
                  </p>
                </Link>

                <SendReminder
                  quoteId={quote.id}
                  url={reminder.url}
                  hasRecipient={reminder.hasRecipient}
                />
              </div>
            );
          })}
        </section>
      ) : null}

      {quotes.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center">
          <p className="font-semibold">אין כאן עדיין הצעות מחיר</p>
          <p className="mt-1 text-sm text-muted">
            בנה הצעה, שלח אותה בוואטסאפ, ותדע בדיוק מתי הלקוח פתח אותה.
          </p>
          <ButtonLink href="/dashboard/quotes/new" className="mt-4">
            יצירת ההצעה הראשונה
          </ButtonLink>
        </div>
      ) : (
        <>
          <nav aria-label="סינון לפי סטטוס" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {FILTERS.map((option) => {
              const isActive = option.key === activeFilter;
              return (
                <Link
                  key={option.key}
                  href={
                    option.key === "all"
                      ? "/dashboard"
                      : `/dashboard?filter=${option.key}`
                  }
                  aria-current={isActive ? "true" : undefined}
                  className={
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                    (isActive
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-muted hover:bg-background")
                  }
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>

          {visibleQuotes.length === 0 ? (
            <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
              אין הצעות בסטטוס הזה.
            </p>
          ) : (
            /* One column on a phone, two once the shell is wide enough that a
               single row would be a name at one edge and a price at the other
               with 700px of nothing between them. */
            <ul className="grid gap-2 lg:grid-cols-2">
              {visibleQuotes.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/dashboard/quotes/${quote.id}`}
                    className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">
                          {quote.clients?.full_name ?? "לקוח שנמחק"}
                        </p>
                        <StatusBadge status={quote.status} />
                      </div>
                      <p className="numeric mt-0.5 text-sm text-muted">
                        הצעה #{quote.quote_number} ·{" "}
                        {formatDate(quote.sent_at ?? quote.issued_at)}
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
        </>
      )}
    </div>
  );
}
