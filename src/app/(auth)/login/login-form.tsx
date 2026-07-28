"use client";

import { useActionState } from "react";

import { signInAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import type { AuthFormState } from "@/lib/validation";

const INITIAL_STATE: AuthFormState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />

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
        autoComplete="current-password"
        dir="ltr"
        className="text-start"
        required
      />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton pendingLabel="מתחבר…">התחברות</SubmitButton>
    </form>
  );
}
