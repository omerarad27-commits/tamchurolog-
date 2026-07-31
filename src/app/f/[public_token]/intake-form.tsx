"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { MAX_ANSWER_LENGTH, type IntakeQuestion } from "@/lib/intake";

import { EMPTY_INTAKE_STATE, submitIntakeAction } from "./actions";

export function IntakeForm({
  token,
  questions,
}: {
  token: string;
  questions: IntakeQuestion[];
}) {
  const [state, formAction] = useActionState(
    submitIntakeAction,
    EMPTY_INTAKE_STATE,
  );

  if (state.done) {
    return (
      <div className="rounded-card border border-success/30 bg-success-soft p-6 text-center">
        <p className="text-lg font-bold text-success">תודה!</p>
        <p className="mt-1 text-sm text-success">
          התשובות נשלחו. נחזור אליך עם הצעת מחיר.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
        >
          <legend className="px-1 text-base font-semibold">
            <span className="numeric">{index + 1}</span>. {question.prompt}
          </legend>

          {question.kind === "choice" ? (
            <div className="flex flex-col gap-2">
              {question.options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-control border border-border px-4 py-3 text-base has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    className="h-5 w-5 shrink-0 accent-[color:var(--brand)]"
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              name={question.id}
              rows={3}
              maxLength={MAX_ANSWER_LENGTH}
              aria-label={question.prompt}
              className="w-full rounded-control border border-border bg-surface px-3 py-2.5 text-base leading-relaxed focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand"
            />
          )}
        </fieldset>
      ))}

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton pendingLabel="שולח…">שליחת התשובות</SubmitButton>
    </form>
  );
}
