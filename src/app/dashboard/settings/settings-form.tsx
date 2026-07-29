"use client";

import Image from "next/image";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextArea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Business } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import { updateBusinessAction } from "./actions";

export function SettingsForm({ business }: { business: Business }) {
  const [state, formAction] = useActionState(
    updateBusinessAction,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="שם העסק"
        name="name"
        defaultValue={business.name}
        placeholder="לדוגמה: אינסטלציה כהן"
        hint="מופיע ללקוחות בראש הצעת המחיר."
        maxLength={80}
        required
      />

      <TextField
        label="טלפון"
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        className="text-start"
        defaultValue={formatPhoneForDisplay(business.phone)}
        placeholder="054-1234567"
        hint="אפשר להזין בכל פורמט. אנחנו נסדר אותו."
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="logo" className="text-sm font-medium">
          לוגו
        </label>

        {business.logo_url ? (
          <div className="flex items-center gap-3">
            <Image
              src={business.logo_url}
              alt="הלוגו הנוכחי של העסק"
              width={56}
              height={56}
              className="h-14 w-14 rounded-tile border border-border bg-surface object-contain"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="removeLogo"
                className="h-4 w-4 accent-[color:var(--danger)]"
              />
              הסר את הלוגו
            </label>
          </div>
        ) : null}

        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="w-full rounded-control border border-border bg-surface p-2 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand"
        />
        <p className="text-xs text-muted">PNG, JPG, WEBP או SVG. עד 2MB.</p>
      </div>

      <TextArea
        label="תנאים והערות ברירת מחדל"
        name="defaultTerms"
        defaultValue={business.default_terms ?? ""}
        rows={5}
        placeholder="לדוגמה: המחירים אינם כוללים מע״מ. ההצעה בתוקף ל-14 יום."
        hint="יופיע בתחתית כל הצעת מחיר חדשה."
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">מטבע</span>
        <p className="rounded-tile border border-border bg-background px-3 py-3 text-sm text-muted">
          שקל חדש (₪) — קבוע בשלב זה.
        </p>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SubmitButton pendingLabel="שומר…">שמירה</SubmitButton>
    </form>
  );
}
