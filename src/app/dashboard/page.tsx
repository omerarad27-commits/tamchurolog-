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
import { formatILS } from "@/lib/format";
import type { QuoteWithClient } from "@/lib/types";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  pickTip,
  PRICE_LIST_TIP_AFTER_QUOTES,
  SEARCH_TIP_AFTER_QUOTES,
  type TipId,
} from "@/lib/tips";

import { toQuoteListRow } from "@/lib/quote-list-row";

import { QuoteList } from "./quote-list";
import { SendReminder } from "./send-reminder";
import { Tip } from "./tip";

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
      "id, business_id, client_id, title, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, public_token, first_viewed_at, last_viewed_at, decision_signature_name, decided_at, decision_reason, reminded_at, created_at, updated_at, clients (id, full_name, phone)",
    )
    .eq("business_id", business.id)
    .order("quote_number", { ascending: false });

  const quotes = (data ?? []) as unknown as QuoteWithClient[];
  const coldQuotes = quotes.filter(needsFollowUp);
  const visibleQuotes = quotes.filter((q) => matchesFilter(q, activeFilter));

  /*
   * The one tip this screen may show, if any.
   *
   * Both conditions are about what the owner has actually done. The price list
   * is suggested only once there are enough quotes for the retyping to have
   * become noticeable, and only while the list is still empty — suggesting it to
   * someone who already built one would be the app not paying attention.
   *
   * Order is the priority when both hold: building a price list saves minutes
   * on every future quote, finding an old one saves seconds today.
   */
  const { count: priceListCount } = await supabase
    .from("price_list_items")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  const candidates: TipId[] = [];
  if (
    quotes.length >= PRICE_LIST_TIP_AFTER_QUOTES &&
    (priceListCount ?? 0) === 0
  ) {
    candidates.push("price_list");
  }
  if (quotes.length >= SEARCH_TIP_AFTER_QUOTES) candidates.push("search");

  const tip = pickTip(candidates, business.dismissed_tips);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1>הצעות מחיר</h1>
        {/*
          Two ways in, and the quick one is the primary because it is the one
          that fits the job most of these quotes are for. The full builder is
          still one tap away and keeps its own screen; nothing about it changed.
        */}
        <div className="flex shrink-0 gap-2">
          <ButtonLink href="/dashboard/quotes/new" size="sm" variant="secondary">
            טופס מלא
          </ButtonLink>
          <ButtonLink href="/dashboard/quotes/quick" size="sm">
            הצעה מהירה
          </ButtonLink>
        </div>
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
          {/* The quick route, not the full form: the first quote should be the
              one that proves the app works, not the one that teaches it. */}
          <ButtonLink href="/dashboard/quotes/quick" className="mt-4">
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

          {/* Above the list and below the filters, which is where the eye lands
              on the way to the thing the tip is about. */}
          {tip === "price_list" ? (
            <Tip
              id="price_list"
              action={{ href: "/dashboard/pricelist", label: "בניית מחירון" }}
            >
              שמת לב שאתה מקליד את אותם דברים? אפשר לבנות מחירון קבוע ולבחור ממנו
              בלחיצה.
            </Tip>
          ) : null}

          {tip === "search" ? (
            <Tip id="search">
              עכשיו אפשר לחפש הצעה לפי שם לקוח, נושא או מספר — בשדה החיפוש שמעל
              הרשימה.
            </Tip>
          ) : null}

          <QuoteList
            rows={visibleQuotes.map(toQuoteListRow)}
            totalCount={quotes.length}
          />
        </>
      )}
    </div>
  );
}
