import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { checkSupabaseHealth } from "@/lib/supabase/health";

/*
 * The only page here meant to be indexed, so it is the only one that needs to
 * say where it really lives. Every Vercel deployment answers on its own
 * hostname as well as the production one, and without this a crawler that finds
 * a preview URL treats it as a separate, duplicate site.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/*
 * The connection card is a setup aid, not a feature.
 *
 * In development it earns its place: the missing-env branch names exactly which
 * variables are unset, which is the difference between a five second fix and an
 * afternoon. In production it printed the Supabase project host on a page any
 * visitor can open, and it cost a network round trip on the landing page to say
 * something no visitor needs to know.
 *
 * The URL and the anon key are public by design and RLS is the real boundary,
 * so this was untidiness rather than a leak. It still has no business being
 * rendered to strangers.
 */
export default async function HomePage() {
  const showHealth = process.env.NODE_ENV !== "production";

  const [health, user] = await Promise.all([
    showHealth ? checkSupabaseHealth() : null,
    getUser(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-12">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-brand text-2xl font-bold text-brand-foreground"
        >
          ת
        </span>
        <div>
          <h1 className="text-2xl font-bold leading-tight">תמחורולוג</h1>
          <p className="text-sm text-muted">הצעות מחיר שנסגרות, לא נעלמות</p>
        </div>
      </header>

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">
          שולחים הצעת מחיר, ויודעים מה קרה איתה
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          כל הצעה מקבלת קישור אישי. רואים מתי הלקוח פתח אותה, מי שוקל, ומי צריך
          תזכורת — הכל מהטלפון.
        </p>

        {user ? (
          <ButtonLink href="/dashboard" className="mt-4">
            לאזור האישי
          </ButtonLink>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink href="/signup">פתיחת חשבון</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              התחברות
            </ButtonLink>
          </div>
        )}
      </section>

      {health ? <SupabaseHealthCard health={health} /> : null}
    </main>
  );
}

function SupabaseHealthCard({
  health,
}: {
  health: Awaited<ReturnType<typeof checkSupabaseHealth>>;
}) {
  if (health.status === "ok") {
    return (
      <section className="rounded-card border border-border bg-success-soft p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-success"
          />
          <h2 className="font-semibold text-success">החיבור ל‑Supabase תקין</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          מחובר לפרויקט <span className="numeric">{health.detail}</span>
        </p>
      </section>
    );
  }

  if (health.status === "missing-env") {
    return (
      <section className="rounded-card border border-border bg-warning-soft p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning"
          />
          <h2 className="font-semibold text-warning">חסרים משתני סביבה</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          יש להשלים את הערכים הבאים בקובץ{" "}
          <span className="numeric">.env.local</span> ובהגדרות הפרויקט ב‑Vercel:
        </p>
        <ul className="mt-2 space-y-1">
          {health.missing.map((name) => (
            <li
              key={name}
              className="numeric rounded-lg bg-surface px-2 py-1 text-xs text-foreground"
            >
              {name}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-danger-soft p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger"
        />
        <h2 className="font-semibold text-danger">החיבור ל‑Supabase נכשל</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{health.detail}</p>
    </section>
  );
}
