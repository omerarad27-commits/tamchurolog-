"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextArea } from "@/components/ui/textarea";
import { inputClasses, TextField } from "@/components/ui/text-field";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/lib/business-type";
import { formatILS } from "@/lib/format";
import type { Client } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";
import { formatVatRate, splitVat, VAT_RATE } from "@/lib/vat";

import { createQuoteAction, updateQuoteAction } from "./actions";

type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

/** Values an existing quote is loaded with when editing. */
export type QuoteDraft = {
  id: string;
  clientId: string;
  validUntil: string;
  notes: string;
  withVat: boolean;
  pricesIncludeVat: boolean;
  /** Whether a link for this quote is already in a client's hands. */
  wasSent: boolean;
  lines: { description: string; quantity: string; unitPrice: string }[];
};

const NEW_CLIENT = "__new__";

let keyCounter = 0;
function emptyLine(): DraftLine {
  keyCounter += 1;
  return {
    key: `line-${keyCounter}`,
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function linesFromDraft(draft: QuoteDraft | undefined): DraftLine[] {
  if (!draft || draft.lines.length === 0) return [emptyLine()];
  return draft.lines.map((line) => {
    keyCounter += 1;
    return { key: `line-${keyCounter}`, ...line };
  });
}

function toNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function QuoteBuilder({
  clients,
  defaultValidUntil,
  defaultNotes,
  businessType,
  defaultWithVat,
  draft,
}: {
  clients: Client[];
  defaultValidUntil: string;
  defaultNotes: string;
  businessType: BusinessType;
  defaultWithVat: boolean;
  /** Present when editing an existing quote. */
  draft?: QuoteDraft;
}) {
  const isEdit = Boolean(draft);

  const [state, formAction] = useActionState(
    isEdit ? updateQuoteAction : createQuoteAction,
    EMPTY_FORM_STATE,
  );

  const [clientId, setClientId] = useState(
    draft?.clientId ?? (clients.length === 1 ? clients[0].id : ""),
  );
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromDraft(draft));
  const [withVat, setWithVat] = useState(draft?.withVat ?? defaultWithVat);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(
    draft?.pricesIncludeVat ?? false,
  );
  const clientSelectId = useId();
  /*
   * Prefix for the per-line field ids. useId supplies a value that matches
   * between the server and the client render; line.key identifies the row and
   * survives reordering and deletion, which an array index would not.
   */
  const lineFieldPrefix = useId();

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    setLines((current) =>
      current.length === 1
        ? [emptyLine()]
        : current.filter((line) => line.key !== key),
    );
  };

  const moveLine = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    setLines((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const linesTotal = lines.reduce(
    (sum, line) => sum + toNumber(line.quantity) * toNumber(line.unitPrice),
    0,
  );

  // Same function the database uses, so what is shown while typing is what
  // gets stored on save.
  const { subtotal, vat, total } = splitVat(
    linesTotal,
    withVat ? VAT_RATE : 0,
    pricesIncludeVat,
  );

  return (
    <form action={formAction} className="flex w-full max-w-form flex-col gap-5" noValidate>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      {draft ? <input type="hidden" name="quoteId" value={draft.id} /> : null}

      {/* The client may already be holding a link to this quote. Say so before
          they change anything, not after. */}
      {draft?.wasSent ? (
        <Alert tone="info">
          ההצעה כבר נשלחה ללקוח. שמירת שינויים תבטל את הקישור הקודם — מי שייכנס
          אליו יראה שההצעה בוטלה — ותצטרך לשלוח את ההצעה המעודכנת מחדש.
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------- client */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={clientSelectId} className="text-sm font-medium">
            לקוח
          </label>
          <select
            id={clientSelectId}
            name="clientId"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={inputClasses}
            required
          >
            <option value="">בחר לקוח…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
            {/* Quick-add is a creation-time convenience only. */}
            {isEdit ? null : <option value={NEW_CLIENT}>+ לקוח חדש</option>}
          </select>
        </div>

        {clientId === NEW_CLIENT ? (
          <div className="flex flex-col gap-3 rounded-tile bg-background p-3">
            <TextField
              label="שם הלקוח החדש"
              name="newClientName"
              placeholder="לדוגמה: דנה לוי"
              maxLength={80}
            />
            <TextField
              label="טלפון"
              name="newClientPhone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="text-start"
              placeholder="054-1234567"
              hint="בלי טלפון לא נוכל לשלוח את ההצעה בוואטסאפ."
            />
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------- line items */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">פירוט העבודה</h2>

        {lines.map((line, index) => {
          const lineTotal = toNumber(line.quantity) * toNumber(line.unitPrice);

          return (
            <div
              key={line.key}
              className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <span className="numeric mt-3 text-sm font-semibold text-muted">
                  {index + 1}.
                </span>
                <input
                  aria-label={`תיאור פריט ${index + 1}`}
                  value={line.description}
                  onChange={(event) =>
                    updateLine(line.key, { description: event.target.value })
                  }
                  placeholder="תיאור העבודה או החומר"
                  maxLength={300}
                  className={inputClasses}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label
                    htmlFor={`${lineFieldPrefix}-${line.key}-quantity`}
                    className="text-xs font-medium text-muted"
                  >
                    כמות
                  </label>
                  <input
                    id={`${lineFieldPrefix}-${line.key}-quantity`}
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                    inputMode="decimal"
                    dir="ltr"
                    className={`${inputClasses} numeric text-start`}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`${lineFieldPrefix}-${line.key}-unit-price`}
                    className="text-xs font-medium text-muted"
                  >
                    מחיר ליחידה
                  </label>
                  <input
                    id={`${lineFieldPrefix}-${line.key}-unit-price`}
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.key, { unitPrice: event.target.value })
                    }
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="0"
                    className={`${inputClasses} numeric text-start`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="numeric font-semibold">
                  {formatILS(lineTotal)}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveLine(index, -1)}
                    disabled={index === 0}
                    aria-label={`העבר פריט ${index + 1} למעלה`}
                    className="h-10 w-10 rounded-lg text-muted transition-colors hover:bg-background disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLine(index, 1)}
                    disabled={index === lines.length - 1}
                    aria-label={`העבר פריט ${index + 1} למטה`}
                    className="h-10 w-10 rounded-lg text-muted transition-colors hover:bg-background disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`הסר פריט ${index + 1}`}
                    className="h-10 w-10 rounded-lg text-danger transition-colors hover:bg-danger-soft"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="dashed"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          + הוספת פריט
        </Button>
      </section>

      {/* ---------------------------------------------------------- total */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
        {/* A plain checkbox styled as a switch: one tap, and the breakdown
            below updates immediately so the owner sees the effect before
            sending anything. */}
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="font-semibold">
              הוספת מע״מ {formatVatRate(VAT_RATE)}
            </span>
            <span className="block text-sm text-muted">
              {withVat
                ? "המחירים בהצעה יוצגו לפני מע״מ, והמע״מ יתווסף לסכום הסופי."
                : "ההצעה תישלח ללא מע״מ."}
            </span>

            {/* An exempt business is not allowed to charge VAT at all, so if
                the switch is on here it is almost certainly a mistake. */}
            {businessType === "exempt" && withVat ? (
              <span className="mt-1 block text-sm font-medium text-warning">
                העסק מוגדר כ{BUSINESS_TYPE_LABELS.exempt.label}, שאינו רשאי
                לגבות מע״מ. אפשר לשנות את סוג העסק בהגדרות.
              </span>
            ) : null}
          </span>

          <input
            type="checkbox"
            name="withVat"
            checked={withVat}
            onChange={(event) => setWithVat(event.target.checked)}
            className="h-6 w-6 shrink-0 accent-[color:var(--brand)]"
          />
        </label>

        {/* Only meaningful once VAT is on: it says what the numbers typed into
            the line items already mean. */}
        {withVat ? (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <span className="text-sm font-medium">
              המחירים שהזנתי בפריטים הם
            </span>
            <div className="flex gap-2">
              {(
                [
                  { mode: false, label: "לפני מע״מ" },
                  { mode: true, label: "כולל מע״מ" },
                ] as const
              ).map(({ mode, label }) => (
                <label
                  key={label}
                  className={
                    "flex h-control-sm flex-1 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition-colors " +
                    (pricesIncludeVat === mode
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-muted hover:bg-background")
                  }
                >
                  <input
                    type="radio"
                    name="priceMode"
                    value={mode ? "inclusive" : "exclusive"}
                    checked={pricesIncludeVat === mode}
                    onChange={() => setPricesIncludeVat(mode)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">
              {pricesIncludeVat
                ? "המע״מ יחולץ מתוך הסכום שהזנת. הלקוח ישלם בדיוק את מה שרשמת."
                : "המע״מ יתווסף מעל לסכום שהזנת."}
            </p>
          </div>
        ) : null}

        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">
              {withVat ? "סכום לפני מע״מ" : "סכום ביניים"}
            </dt>
            <dd className="numeric font-medium">{formatILS(subtotal)}</dd>
          </div>

          {withVat ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">
                מע״מ {formatVatRate(VAT_RATE)}
              </dt>
              <dd className="numeric font-medium">{formatILS(vat)}</dd>
            </div>
          ) : null}

          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="text-base font-semibold">סה״כ</dt>
            <dd className="numeric text-2xl font-bold">{formatILS(total)}</dd>
          </div>
        </dl>
      </section>

      {/* --------------------------------------------------------- details */}
      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm">
        <TextField
          label="בתוקף עד"
          name="validUntil"
          type="date"
          dir="ltr"
          className="text-start"
          defaultValue={draft?.validUntil ?? defaultValidUntil}
        />

        <TextArea
          label="הערות ותנאים"
          name="notes"
          rows={4}
          defaultValue={draft?.notes ?? defaultNotes}
          hint="נלקח מברירת המחדל בהגדרות. אפשר לשנות עבור ההצעה הזו."
        />
      </section>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <SubmitButton pendingLabel="שומר…">
          {isEdit ? "שמירת השינויים" : "שמירה כטיוטה"}
        </SubmitButton>
        <ButtonLink
          href={draft ? `/dashboard/quotes/${draft.id}` : "/dashboard"}
          variant="secondary"
        >
          ביטול
        </ButtonLink>
      </div>
    </form>
  );
}
