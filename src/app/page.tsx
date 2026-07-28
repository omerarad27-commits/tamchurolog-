import { checkSupabaseHealth } from "@/lib/supabase/health";

export default async function HomePage() {
  const health = await checkSupabaseHealth();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-12">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-brand-foreground"
        >
          ת
        </span>
        <div>
          <h1 className="text-2xl font-bold leading-tight">תמחורולוג</h1>
          <p className="text-sm text-muted">הצעות מחיר שנסגרות, לא נעלמות</p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold">המערכת פועלת</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          שלב 0 הושלם: השלד הוקם, העברית והכיווניות עובדות, והחיבור למסד הנתונים
          נבדק בכל טעינה של הדף הזה.
        </p>
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
      <section className="rounded-2xl border border-border bg-success-soft p-5">
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
      <section className="rounded-2xl border border-border bg-warning-soft p-5">
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
    <section className="rounded-2xl border border-border bg-danger-soft p-5">
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
