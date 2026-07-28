"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextArea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { Client } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import { createClientAction, updateClientAction } from "./actions";

export function ClientForm({ client }: { client?: Client }) {
  const isEdit = Boolean(client);
  const [state, formAction] = useActionState(
    isEdit ? updateClientAction : createClientAction,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <TextField
        label="שם מלא"
        name="fullName"
        defaultValue={client?.full_name ?? ""}
        placeholder="לדוגמה: דנה לוי"
        autoComplete="name"
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
        defaultValue={formatPhoneForDisplay(client?.phone ?? null)}
        placeholder="054-1234567"
        hint="נחוץ כדי לשלוח את ההצעה בוואטסאפ."
      />

      <TextField
        label="אימייל (לא חובה)"
        name="email"
        type="email"
        inputMode="email"
        dir="ltr"
        className="text-start"
        defaultValue={client?.email ?? ""}
        placeholder="dana@example.com"
      />

      <TextArea
        label="הערות (לא חובה)"
        name="notes"
        rows={3}
        defaultValue={client?.notes ?? ""}
        placeholder="לדוגמה: קומה 3 בלי מעלית, עדיף להתקשר אחרי 16:00"
      />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton pendingLabel="שומר…">
        {isEdit ? "שמירת שינויים" : "הוספת לקוח"}
      </SubmitButton>
    </form>
  );
}
