import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth";
import { QUOTE_STATUS } from "@/lib/quote-status";
import {
  computeQuoteStats,
  formatCloseRate,
  formatDecisionTime,
  type StatsInput,
} from "@/lib/stats";
import type { QuoteStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "סיכום | תמחורולוג",
};

/** Order the owner reads them in, not the order the enum happens to be in. */
const STATUS_ORDER: QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "approved",
  "declined",
  "expired",
];

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-muted">{label}</h2>
      <p className="numeric mt-1 text-3xl font-bold">{value}</p>
      {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
    </div>
  );
}

export default async function StatsPage() {
  const { supabase, business } = await requireBusiness();

  const { data, error } = await supabase
    .from("quotes")
    .select("status, sent_at, decided_at")
    .eq("business_id", business.id);

  const stats = computeQuoteStats((data ?? []) as StatsInput[]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">סיכום</h1>
        <p className="mt-1 text-sm text-muted">
          המספרים מתייחסים לכל ההצעות שיצרת עד היום.
        </p>
      </div>

      {error ? (
        <p className="rounded-tile border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          טעינת הנתונים נכשלה. רענן את הדף ונסה שוב.
        </p>
      ) : null}

      <Figure
        label="הצעות שנשלחו"
        value={String(stats.sent)}
        note={
          stats.total > stats.sent
            ? `בנוסף ${stats.total - stats.sent} טיוטות שטרם נשלחו`
            : undefined
        }
      />

      <Figure
        label="אחוז סגירה"
        value={formatCloseRate(stats.closeRate)}
        note={
          stats.closeRate === null
            ? "אין עדיין הצעות שהוכרעו, אז אין מה לחשב"
            : `${stats.approved} אושרו מתוך ${stats.decided} שהוכרעו`
        }
      />

      <Figure
        label="זמן ממוצע עד החלטה"
        value={formatDecisionTime(stats.averageDecisionHours)}
        note={
          stats.averageDecisionSample === 0
            ? "יחושב אחרי שהצעה ראשונה תוכרע"
            : `לפי ${stats.averageDecisionSample} הצעות שהוכרעו`
        }
      />

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted">לפי סטטוס</h2>
        <dl className="mt-2 flex flex-col">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
            >
              <dt>{QUOTE_STATUS[status].label}</dt>
              <dd className="numeric font-semibold">{stats.byStatus[status]}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t-2 border-foreground/10 pt-2">
            <dt className="font-semibold">סה״כ</dt>
            <dd className="numeric font-bold">{stats.total}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
