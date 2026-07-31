"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses, TextField } from "@/components/ui/text-field";
import {
  MAX_FORM_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  type IntakeQuestion,
} from "@/lib/intake";
import { INTAKE_BANK } from "@/lib/intake-bank";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import { createFormAction, updateFormAction } from "./actions";

export type FormDraft = {
  id: string;
  name: string;
  questions: IntakeQuestion[];
};

type FreeTextLine = { id: string; prompt: string };

/**
 * Free-text ids are "text-N" with N above every N already in the draft, so
 * editing a saved form never reuses an id that an existing question holds.
 * Bank questions use their bank key as their id, which is stable by
 * construction.
 */
function nextTextId(existing: { id: string }[]): string {
  let highest = 0;
  for (const question of existing) {
    const match = /^text-(\d+)$/.exec(question.id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `text-${highest + 1}`;
}

export function FormBuilder({ draft }: { draft?: FormDraft }) {
  const isEdit = Boolean(draft);

  const [state, formAction] = useActionState(
    isEdit ? updateFormAction : createFormAction,
    EMPTY_FORM_STATE,
  );

  const [selectedBank, setSelectedBank] = useState<string[]>(() =>
    INTAKE_BANK.filter((bank) =>
      draft?.questions.some((question) => question.id === bank.key),
    ).map((bank) => bank.key),
  );

  const [freeText, setFreeText] = useState<FreeTextLine[]>(() =>
    (draft?.questions ?? [])
      .filter((question) => question.kind === "text")
      .map((question) => ({ id: question.id, prompt: question.prompt })),
  );

  /*
   * Controlled (not defaultValue) so a validation error that re-renders the
   * form via useActionState without a redirect does not wipe out what the
   * owner already typed — React resets uncontrolled fields on every
   * non-redirecting form-action submission.
   */
  const [name, setName] = useState(draft?.name ?? "");

  const fieldPrefix = useId();

  /*
   * The bank questions come first and in bank order, so the form a client sees
   * matches the order the builder shows regardless of the order they were
   * ticked in.
   */
  const questions: IntakeQuestion[] = [
    ...INTAKE_BANK.filter((bank) => selectedBank.includes(bank.key)).map(
      (bank): IntakeQuestion => ({
        id: bank.key,
        kind: "choice",
        prompt: bank.prompt,
        options: [...bank.options],
      }),
    ),
    ...freeText.map((line): IntakeQuestion => ({
      id: line.id,
      kind: "text",
      prompt: line.prompt,
    })),
  ];

  const toggleBank = (key: string) => {
    setSelectedBank((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  return (
    <form action={formAction} className="flex w-full max-w-form flex-col gap-5" noValidate>
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      {draft ? <input type="hidden" name="formId" value={draft.id} /> : null}

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <TextField
          label="שם השאלון"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_FORM_NAME_LENGTH}
          placeholder="לדוגמה: שאלון שיפוץ מקלחת"
          hint="השם הזה נראה רק לך, כדי למצוא את השאלון ברשימה."
        />
      </section>

      {/* ------------------------------------------------ the built-in bank */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-bold">שאלות מוכנות</h2>
        <p className="text-sm text-muted">
          שאלות שחוזרות כמעט בכל עבודה. סמן את מה שרלוונטי.
        </p>

        {INTAKE_BANK.map((bank) => (
          <label
            key={bank.key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-tile bg-background p-3"
          >
            <span>
              <span className="font-medium">{bank.prompt}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {bank.options.join(" · ")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={selectedBank.includes(bank.key)}
              onChange={() => toggleBank(bank.key)}
              className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--brand)]"
            />
          </label>
        ))}
      </section>

      {/* -------------------------------------------------- free text ones */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">שאלות משלך</h2>

        {freeText.map((line, index) => (
          <div
            key={line.id}
            className="flex items-start gap-2 rounded-card border border-border bg-surface p-4 shadow-sm"
          >
            <span className="numeric mt-3 text-sm font-semibold text-muted">
              {index + 1}.
            </span>
            <input
              id={`${fieldPrefix}-${line.id}`}
              aria-label={`שאלה ${index + 1}`}
              value={line.prompt}
              onChange={(event) =>
                setFreeText((current) =>
                  current.map((item) =>
                    item.id === line.id
                      ? { ...item, prompt: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="לדוגמה: מה גודל החדר במטרים?"
              maxLength={MAX_PROMPT_LENGTH}
              className={inputClasses}
            />
            <button
              type="button"
              onClick={() =>
                setFreeText((current) =>
                  current.filter((item) => item.id !== line.id),
                )
              }
              aria-label={`הסר שאלה ${index + 1}`}
              className="mt-0.5 h-control w-11 shrink-0 rounded-lg text-danger transition-colors hover:bg-danger-soft"
            >
              ✕
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="dashed"
          onClick={() =>
            setFreeText((current) => [
              ...current,
              { id: nextTextId([...questions, ...current]), prompt: "" },
            ])
          }
        >
          + הוספת שאלה
        </Button>
      </section>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <SubmitButton pendingLabel="שומר…">
          {isEdit ? "שמירת השינויים" : "שמירת השאלון"}
        </SubmitButton>
        <ButtonLink href="/dashboard/forms" variant="secondary">
          ביטול
        </ButtonLink>
      </div>
    </form>
  );
}
