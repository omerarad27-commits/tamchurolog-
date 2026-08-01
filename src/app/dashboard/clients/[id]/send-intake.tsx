"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses } from "@/components/ui/text-field";
import { EMPTY_INTAKE_SEND_STATE } from "@/lib/intake";
import { buildIntakeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import { createIntakeRequestAction } from "./intake-actions";

export function SendIntake({
  clientId,
  clientName,
  clientPhone,
  businessName,
  siteUrl,
  forms,
  initialFormId,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  businessName: string;
  siteUrl: string;
  forms: { id: string; name: string }[];
  /** A form just written from this page, to arrive back already chosen. */
  initialFormId?: string | null;
}) {
  const [state, formAction] = useActionState(
    createIntakeRequestAction,
    EMPTY_INTAKE_SEND_STATE,
  );
  /*
   * A form named in the URL wins over the single-form shortcut: the owner has
   * just written it, and it is the one they meant. Checked against the list so
   * a hand-typed id cannot leave the select on a value it does not offer.
   */
  const [formId, setFormId] = useState(() => {
    if (initialFormId && forms.some((form) => form.id === initialFormId)) {
      return initialFormId;
    }
    return forms.length === 1 ? forms[0].id : "";
  });
  const selectId = useId();

  /*
   * Writing a new questionnaire goes to the real builder rather than a second
   * copy of it inlined here. A questionnaire is a name and any number of
   * questions, and a shrunken version on this page would be a second thing to
   * keep in step with the first. The round trip returns here with the new form
   * chosen, so it costs the owner a screen and no lost place.
   */
  const newFormHref = `/dashboard/forms/new?returnTo=${encodeURIComponent(
    `/dashboard/clients/${clientId}`,
  )}`;

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
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          עדיין לא יצרת שאלון. אפשר ליצור אחד עכשיו ולחזור לכאן לשליחה.
        </p>
        <ButtonLink href={newFormHref} variant="secondary" size="sm">
          יצירת שאלון חדש
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={selectId} className="text-sm font-medium">
              איזה שאלון לשלוח?
            </label>
            {/*
              A link, not an option inside the select: choosing from a dropdown
              should never navigate away, and this leaves the page.
            */}
            <Link
              href={newFormHref}
              className="shrink-0 text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              + שאלון חדש
            </Link>
          </div>
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
