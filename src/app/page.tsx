import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/app/(auth)/signup/signup-form";
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

/**
 * What the product does, in the order a tradesperson cares about it.
 *
 * Outcomes rather than features: nobody wants a "quote management system",
 * they want to know whether the client opened it.
 */
const VALUE_POINTS = [
  {
    title: "שולחים בוואטסאפ",
    body: "כל הצעה מקבלת קישור אישי. הלקוח פותח אותו בטלפון, בלי אפליקציה ובלי הרשמה.",
  },
  {
    title: "רואים מתי היא נפתחה",
    body: "יודעים מי קרא ומי מתלבט, ולמי כדאי לשלוח תזכורת לפני שההצעה מתקררת.",
  },
  {
    title: "הלקוח מאשר בלחיצה",
    body: "אישור בשמו המלא נשמר על ההצעה, ואתם מקבלים תשובה ברורה במקום שתיקה.",
  },
];

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
    /*
      Two columns from lg up: the pitch on one side, the thing to do about it
      on the other, both visible without scrolling. Below that they stack, and
      the form comes second — on a phone the reason to sign up has to arrive
      before the form asking you to.
    */
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-app flex-1 flex-col justify-center gap-8 px-5 py-10 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
      <div className="flex w-full flex-col gap-6 lg:max-w-lg">
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-brand text-2xl font-bold text-brand-foreground"
          >
            ת
          </span>
          <p className="text-lg font-bold">תמחורולוג</p>
        </header>

        <div>
          <h1 className="text-balance">הצעות מחיר שנסגרות, לא נעלמות</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            שולחים הצעת מחיר בוואטסאפ, ורואים בדיוק מה קרה איתה. לבעלי מקצוע
            שרוצים לדעת מי קרא, מי מתלבט ומי כבר אישר.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {VALUE_POINTS.map((point) => (
            <li key={point.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
              >
                ✓
              </span>
              <div>
                <p className="font-semibold">{point.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">
                  {point.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------------- sign up */}
      <div className="w-full lg:max-w-form lg:flex-1">
        {user ? (
          <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold">כבר מחוברים</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              אפשר להמשיך ישר לאזור האישי.
            </p>
            <ButtonLink href="/dashboard" className="mt-4">
              לאזור האישי
            </ButtonLink>
          </section>
        ) : (
          <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold">פתיחת חשבון</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              דקה אחת, ואפשר לשלוח את הצעת המחיר הראשונה.
            </p>

            <SignupForm />

            <p className="mt-5 text-center text-sm text-muted">
              כבר יש לך חשבון?{" "}
              <Link
                href="/login"
                className="font-semibold text-brand hover:underline"
              >
                התחברות
              </Link>
            </p>
          </section>
        )}

        {health ? (
          <div className="mt-4">
            <SupabaseHealthCard health={health} />
          </div>
        ) : null}
      </div>
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
