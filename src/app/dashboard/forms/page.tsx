import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { parseQuestions } from "@/lib/intake";

export const metadata: Metadata = {
  title: "שאלונים | תמחורולוג",
};

export default async function FormsPage() {
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const forms = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">שאלונים</h1>
        <p className="mt-1 text-sm text-muted">
          שאלון קצר שנשלח ללקוח בוואטסאפ, כדי לדעת מה צריך לפני שמתמחרים.
        </p>
      </div>

      <ButtonLink href="/dashboard/forms/new">שאלון חדש</ButtonLink>

      {forms.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">
          עדיין לא יצרת שאלון.
        </p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {forms.map((form) => {
            const count = parseQuestions(form.questions).length;
            return (
              <li key={form.id}>
                <Link
                  href={`/dashboard/forms/${form.id}`}
                  className="flex flex-col gap-0.5 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
                >
                  <span className="truncate font-semibold">{form.name}</span>
                  {/* .numeric on the line would turn the whole row LTR and drag
                      it away from the right edge. Only the digits are isolated. */}
                  <span className="text-sm text-muted">
                    <span className="numeric">{count}</span> שאלות
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
