"use client";

import { useActionState } from "react";

import { signUpAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { BusinessTypePicker } from "@/components/ui/business-type-picker";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { MIN_PASSWORD_LENGTH, type AuthFormState } from "@/lib/validation";

const INITIAL_STATE: AuthFormState = { error: null };

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="שם העסק"
        name="businessName"
        type="text"
        autoComplete="organization"
        placeholder="לדוגמה: אינסטלציה כהן"
        hint="השם הזה יופיע ללקוחות שלך על הצעת המחיר."
        required
      />

      <BusinessTypePicker />

      <TextField
        label="אימייל"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        dir="ltr"
        className="text-start"
        placeholder="you@example.com"
        required
      />

      <TextField
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        className="text-start"
        hint={`לפחות ${MIN_PASSWORD_LENGTH} תווים.`}
        required
      />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton pendingLabel="פותח חשבון…">פתיחת חשבון</SubmitButton>
    </form>
  );
}
