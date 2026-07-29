import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { formatDate, formatILS } from "@/lib/format";
import type { QuoteWithClient } from "@/lib/types";

export const metadata: Metadata = {
  title: "הצעות מחיר | תמחורולוג",
};

export default async function DashboardPage() {
  const { supabase, business } = await requireBusiness();

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, business_id, client_id, quote_number, status, issued_at, sent_at, valid_until, notes, subtotal, tax_amount, total, public_token, created_at, updated_at, clients (id, full_name, phone)",
    )
    .eq("business_id", business.id)
    .order("quote_number", { ascending: false });

  const quotes = (data ?? []) as unknown as QuoteWithClient[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">הצעות מחיר</h1>
        <ButtonLink href="/dashboard/quotes/new" size="sm">
          הצעה חדשה
        </ButtonLink>
      </div>

      {error ? (
        <p className="rounded-tile border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          טעינת ההצעות נכשלה. רענן את הדף ונסה שוב.
        </p>
      ) : quotes.length === 0 ? (
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
        <ul className="flex flex-col gap-2">
          {quotes.map((quote) => (
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
                    הצעה #{quote.quote_number} · {formatDate(quote.issued_at)}
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
    </div>
  );
}
