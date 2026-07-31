"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses } from "@/components/ui/text-field";
import { buildIntakeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  createIntakeRequestAction,
  EMPTY_INTAKE_SEND_STATE,
} from "./intake-actions";

export function SendIntake({
  clientId,
  clientName,
  clientPhone,
  businessName,
  siteUrl,
  forms,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  businessName: string;
  siteUrl: string;
  forms: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    createIntakeRequestAction,
    EMPTY_INTAKE_SEND_STATE,
  );
  const [formId, setFormId] = useState(forms.length === 1 ? forms[0].id : "");
  const selectId = useId();

  /*
   * Two taps, not one, and this is deliberate.
   *
   * A browser blocks a window opened after an await, which is why every
   * WhatsApp hand-off in this app is a real <a> the user clicks directly. The
   * token cannot exist before the row does, so a single tap would have to
   * either open the window after the server call — the blocked case — or
   * pre-create a request for every saved form on page load, littering the
   * table with rows nobody sent.
   *
   * A GET link that creates the row and redirects is worse: next/link
   * prefetches, so merely hovering the list would create rows.
   */
  // Without the formId check, changing the dropdown after preparing a link
  // leaves the old token's link on screen under the new form's name, and the
  // owner sends the client the wrong questionnaire. Once the selection moves
  // on, the link simply disappears until a fresh one is prepared for it.
  const link = state.token && state.formId === formId
    ? buildWhatsAppUrl(
        clientPhone,
        buildIntakeMessage({
          businessName,
          clientName,
          formUrl: `${siteUrl}/f/${state.token}`,
        }),
      )
    : null;

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted">
        עדיין לא יצרת שאלון. אפשר ליצור אחד במסך השאלונים.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            איזה שאלון לשלוח?
          </label>
          <select
            id={selectId}
            name="formId"
            value={formId}
            onChange={(event) => setFormId(event.target.value)}
            className={inputClasses}
            required
          >
            <option value="">בחר שאלון…</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton pendingLabel="מכין קישור…" variant="secondary">
          הכנת קישור
        </SubmitButton>
      </form>

      {state.error ? <Alert>{state.error}</Alert> : null}

      {link ? (
        <div className="flex flex-col gap-2 rounded-tile bg-background p-3">
          <p className="text-sm">
            הקישור מוכן.
            {link.hasRecipient
              ? ""
              : " ללקוח אין טלפון שמור, אז וואטסאפ ישאל למי לשלוח."}
          </p>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "primary" })}
          >
            שליחה בוואטסאפ
          </a>
        </div>
      ) : null}
    </div>
  );
}
