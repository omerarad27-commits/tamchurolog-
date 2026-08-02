"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses, TextField } from "@/components/ui/text-field";
import { formatILS, formatQuantity } from "@/lib/format";
import type { Client, PriceListItem } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";
import { formatVatRate, splitVat, vatFieldsFor, VAT_RATE, type VatMode } from "@/lib/vat";

import { createQuickQuoteAction } from "../actions";

const NEW_CLIENT = "__new__";

/*
 * The same three choices the full builder offers, asked as one question.
 *
 * The builder splits it into a VAT switch and a prices-are toggle because it
 * also has to explain what the line items mean. Here there is one number, so
 * there is one question about it.
 */
const VAT_CHOICES: { mode: VatMode; label: string; hint: string }[] = [
  {
    mode: "exclusive",
    label: "לפני מע״מ",
    hint: `המע״מ ${formatVatRate(VAT_RATE)} יתווסף מעל הסכום שהזנת.`,
  },
  {
    mode: "inclusive",
    label: "כולל מע״מ",
    hint: "המע״מ יחולץ מתוך הסכום. הלקוח ישלם בדיוק את מה שרשמת.",
  },
  {
    mode: "none",
    label: "בלי מע״מ",
    hint: "ההצעה תישלח בלי מע״מ, לעסק שאינו גובה אותו.",
  },
];

/**
 * Three questions and one button.
 *
 * Everything the full builder asks about — line items, quantities, validity,
 * terms, whether prices include VAT — is answered here from the settings the
 * owner filled in once. What is left is what they would say on the phone: who,
 * what, how much.
 *
 * The target is under thirty seconds from the home screen to a sent WhatsApp
 * message, which is why there is no confirmation step, no preview and no second
 * screen: the action creates the quote and WhatsApp opens on arrival.
 */
export function QuickQuoteForm({
  clients,
  priceList,
  defaultVatMode,
}: {
  clients: Client[];
  /** The owner's saved items. Empty is normal: the picker simply does not appear. */
  priceList: PriceListItem[];
  /** What the business type implies, as the starting choice rather than the answer. */
  defaultVatMode: VatMode;
}) {
  const [state, formAction] = useActionState(
    createQuickQuoteAction,
    EMPTY_FORM_STATE,
  );

  const [clientId, setClientId] = useState(
    clients.length === 1 ? clients[0].id : "",
  );
  /* Kept so the "want to itemise?" link can carry them across. */
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [vatMode, setVatMode] = useState<VatMode>(defaultVatMode);
  /** True while the price list panel is open under the amount. */
  const [pickerOpen, setPickerOpen] = useState(false);

  const clientSelectId = useId();

  /*
   * A saved item answers both questions this screen asks about the work, so it
   * fills both: a quick quote is one job at one price, and leaving half of it
   * for the owner to copy across by hand would defeat the point of picking.
   *
   * Copied by value. Editing the amount afterwards is a decision about this
   * quote and must never travel back to the price list.
   */
  const pickFromPriceList = (item: PriceListItem) => {
    setTitle(item.name);
    setAmount(formatQuantity(Number(item.unit_price)));
    setPickerOpen(false);
  };

  /*
   * The breakdown, live under the field.
   *
   * Worth the few lines: "before VAT" and "including VAT" on the same 1000
   * differ by 180 shekels, and this screen sends the quote without a preview
   * step. Same splitVat the builder and the database use, so what is shown
   * here is what gets stored.
   */
  const typedAmount = Number(amount.trim().replace(",", "."));
  const vatFields = vatFieldsFor(vatMode);
  const breakdown = Number.isFinite(typedAmount) && typedAmount > 0
    ? splitVat(typedAmount, vatFields.vatRate, vatFields.pricesIncludeVat)
    : null;

  /*
   * The escape hatch to the full form, with what has been typed so far.
   *
   * A link rather than a button, so it is obvious it leaves this screen, and
   * small rather than prominent, because the whole point of this route is that
   * most quotes never need it.
   */
  const detailedHref = (() => {
    const params = new URLSearchParams();
    if (clientId && clientId !== NEW_CLIENT) params.set("clientId", clientId);
    if (title.trim()) params.set("title", title.trim());
    if (amount.trim()) params.set("amount", amount.trim());
    params.set("vat", vatMode);
    const query = params.toString();
    return query ? `/dashboard/quotes/new?${query}` : "/dashboard/quotes/new";
  })();

  return (
    <form action={formAction} className="flex w-full max-w-form flex-col gap-5" noValidate>
      {/* ------------------------------------------------------------ who */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={clientSelectId} className="text-sm font-medium">
            למי
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
            <option value={NEW_CLIENT}>+ לקוח חדש</option>
          </select>
        </div>

        {clientId === NEW_CLIENT ? (
          <div className="flex flex-col gap-3 rounded-tile bg-background p-3">
            <TextField
              label="שם הלקוח"
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
              hint="בלי טלפון וואטסאפ יבקש לבחור נמען."
            />
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------- what, how much */}
      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm">
        <TextField
          label="על מה"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="לדוגמה: תיקון נזילה במקלחת"
        />

        <TextField
          label="כמה"
          name="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          dir="ltr"
          className="numeric text-start"
          placeholder="0"
        />

        {priceList.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
            >
              {pickerOpen ? "סגירת המחירון" : "בחירה מהמחירון"}
            </Button>

            {pickerOpen ? (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-card border border-border p-2">
                {priceList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pickFromPriceList(item)}
                      className="flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-start transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.name}
                      </span>
                      <span className="numeric shrink-0 text-sm text-muted">
                        {formatILS(Number(item.unit_price))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">הסכום שהזנתי הוא</legend>
          <div className="flex gap-2">
            {VAT_CHOICES.map((choice) => (
              <label
                key={choice.mode}
                className={
                  "flex h-control-sm flex-1 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand " +
                  (vatMode === choice.mode
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-surface text-muted hover:bg-background")
                }
              >
                <input
                  type="radio"
                  name="vatMode"
                  value={choice.mode}
                  checked={vatMode === choice.mode}
                  onChange={() => setVatMode(choice.mode)}
                  className="sr-only"
                />
                {choice.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">
            {VAT_CHOICES.find((choice) => choice.mode === vatMode)?.hint}
          </p>
        </fieldset>

        {breakdown ? (
          <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            {vatMode === "none" ? null : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">לפני מע״מ</dt>
                  <dd className="numeric">{formatILS(breakdown.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">
                    מע״מ {formatVatRate(VAT_RATE)}
                  </dt>
                  <dd className="numeric">{formatILS(breakdown.vat)}</dd>
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
              <dt className="font-semibold">הלקוח משלם</dt>
              <dd className="numeric text-lg font-bold">
                {formatILS(breakdown.total)}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex flex-col gap-3">
        <SubmitButton pendingLabel="מכין את ההצעה…">
          שליחה בוואטסאפ
        </SubmitButton>

        {/*
          Not a <Link>: the values live in this component's state, and Next's
          client router would prefetch a URL built from stale input. A plain
          anchor navigates to whatever the href says at the moment of the tap.
        */}
        <a
          href={detailedHref}
          className="text-center text-sm font-semibold text-brand hover:underline"
        >
          רוצה לפרט? מעבר לטופס המלא
        </a>
      </div>
    </form>
  );
}
