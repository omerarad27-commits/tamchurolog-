"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { formatILS, formatQuantity } from "@/lib/format";
import type { PriceListItem } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import {
  createPriceItemAction,
  deletePriceItemAction,
  movePriceItemAction,
  updatePriceItemAction,
} from "./actions";

/**
 * The whole price list on one screen.
 *
 * Adding, renaming, repricing, reordering and deleting all happen here rather
 * than through a row that navigates to its own page. The list is short by
 * nature — five to twenty lines — and the owner is usually correcting one
 * number, which is not worth two page loads.
 */
export function PriceListManager({ items }: { items: PriceListItem[] }) {
  const [state, formAction] = useActionState(
    createPriceItemAction,
    EMPTY_FORM_STATE,
  );

  /** Which row, if any, is currently open for editing. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  /*
   * After a successful add, empty the fields and put the cursor back on the
   * name. Someone building their list types four items in a row, and the
   * alternative is reaching for the field again each time.
   */
  useEffect(() => {
    if (!state.success) return;
    const form = nameInputRef.current?.form;
    form?.reset();
    nameInputRef.current?.focus();
    /*
     * Depends on the state object, not on state.success.
     *
     * Adding the same item twice produces the identical success string, and a
     * dependency on the string would compare equal and skip the reset — leaving
     * the second add sitting in a form that looks unsubmitted. useActionState
     * hands back a fresh object per run, so identity is the honest signal.
     */
  }, [state]);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------ add */}
      <form
        action={formAction}
        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm"
        noValidate
      >
        <h2 className="font-bold">הוספת פריט</h2>

        <TextField
          ref={nameInputRef}
          label="שם הפריט"
          name="name"
          maxLength={120}
          placeholder="לדוגמה: פתיחת סתימה במטבח"
        />
        <TextField
          label="מחיר ברירת מחדל"
          name="unitPrice"
          inputMode="decimal"
          dir="ltr"
          className="numeric text-start"
          placeholder="0"
          hint="אפשר לשנות את המחיר בכל הצעה בלי שזה ישפיע על המחירון."
        />

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <SubmitButton pendingLabel="מוסיף…">הוספה למחירון</SubmitButton>
      </form>

      {/* ----------------------------------------------------------- list */}
      {items.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <PriceItemEditor
                  item={item}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-2 rounded-card border border-border bg-surface p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="numeric text-sm text-muted">
                      {formatILS(Number(item.unit_price))}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/*
                      Each arrow is its own form rather than a shared one with a
                      hidden direction: a form per action means no client state
                      to keep in step with the row it belongs to, and the whole
                      row still works with JavaScript disabled.
                    */}
                    <MoveButton
                      id={item.id}
                      direction="up"
                      disabled={index === 0}
                      label={`העבר את ${item.name} למעלה`}
                    />
                    <MoveButton
                      id={item.id}
                      direction="down"
                      disabled={index === items.length - 1}
                      label={`העבר את ${item.name} למטה`}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingId(item.id)}
                      aria-label={`עריכת ${item.name}`}
                      className="h-10 w-10 rounded-lg text-brand transition-colors hover:bg-brand-soft"
                    >
                      ✎
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
  label,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
  label: string;
}) {
  return (
    <form action={movePriceItemAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="h-10 w-10 rounded-lg text-muted transition-colors hover:bg-background disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

/** The same row, opened for editing in place. */
function PriceItemEditor({
  item,
  onDone,
}: {
  item: PriceListItem;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    updatePriceItemAction,
    EMPTY_FORM_STATE,
  );

  // The action revalidates and the row re-renders with the new values; closing
  // the editor is the only thing left for the client to do.
  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-brand bg-surface p-4 shadow-sm">
      <form action={formAction} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="id" value={item.id} />

        {/* Ids of their own: the add form above is on the page at the same
            time and uses the same field names. */}
        <TextField
          label="שם הפריט"
          name="name"
          id={`name-${item.id}`}
          maxLength={120}
          defaultValue={item.name}
        />
        <TextField
          label="מחיר ברירת מחדל"
          name="unitPrice"
          id={`unitPrice-${item.id}`}
          inputMode="decimal"
          dir="ltr"
          className="numeric text-start"
          defaultValue={formatQuantity(Number(item.unit_price))}
        />

        {state.error ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-2">
          <SubmitButton pendingLabel="שומר…" size="sm">
            שמירה
          </SubmitButton>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDone}
          >
            ביטול
          </Button>
        </div>
      </form>

      {/*
        Outside the edit form, not inside it: a nested form is invalid HTML, and
        a delete button that submits the form it sits in would save the row it
        was asked to remove.
      */}
      <form
        action={deletePriceItemAction}
        onSubmit={(event) => {
          const confirmed = window.confirm(
            `למחוק את "${item.name}" מהמחירון? הצעות שכבר נכתבו לא ישתנו.`,
          );
          if (!confirmed) event.preventDefault();
        }}
        className="border-t border-border pt-3"
      >
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton variant="danger" size="sm" pendingLabel="מוחק…">
          מחיקת הפריט
        </SubmitButton>
      </form>
    </div>
  );
}
