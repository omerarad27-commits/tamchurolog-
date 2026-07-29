import { ButtonLink } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { checkSupabaseHealth } from "@/lib/supabase/health";

export default async function HomePage() {
  const [health, user] = await Promise.all([checkSupabaseHealth(), getUser()]);

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

      <SupabaseHealthCard health={health} />
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
