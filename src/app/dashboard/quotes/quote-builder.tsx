"use client";

import { useActionState, useId, useRef, useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextArea } from "@/components/ui/textarea";
import { inputClasses, TextField } from "@/components/ui/text-field";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/lib/business-type";
import { formatILS, formatQuantity } from "@/lib/format";
import type { Client, PriceListItem } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";
import { formatVatRate, splitVat, VAT_RATE } from "@/lib/vat";

import { rememberPriceItemAction } from "../pricelist/actions";
import { createQuoteAction, updateQuoteAction } from "./actions";

type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

/**
 * Everything about a quote except who it is for and when it expires.
 *
 * Two different things load the form with this: editing a quote, and
 * duplicating one. They differ in exactly the fields left out here — a
 * duplicate has no client, no validity inherited from the original, and no id —
 * which is why those live on QuoteDraft and not in this type.
 */
export type QuoteContents = {
  title: string;
  notes: string;
  withVat: boolean;
  pricesIncludeVat: boolean;
  lines: { description: string; quantity: string; unitPrice: string }[];
  /**
   * The single figure of a quote written without a breakdown, as typed.
   *
   * Empty on an itemized quote. A quote is one or the other, never both: what
   * distinguishes them in the database is simply whether it has line items.
   */
  flatAmount: string;
};

/** Values an existing quote is loaded with when editing. */
export type QuoteDraft = QuoteContents & {
  id: string;
  clientId: string;
  validUntil: string;
  /** Whether a link for this quote is already in a client's hands. */
  wasSent: boolean;
};

/**
 * Itemized quotes list what the work is made of; flat quotes are a headline and
 * a price.
 *
 * The second is what a tradesperson actually says on the phone for a small job
 * ("fixing that leak, four hundred"), and the form used to have no way to
 * express it: the only route to a quote was to invent line items for work that
 * had none. VAT, validity and terms behave identically in both.
 */
type PricingMode = "itemized" | "flat";

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

function linesFrom(contents: QuoteContents | undefined): DraftLine[] {
  if (!contents || contents.lines.length === 0) return [emptyLine()];
  return contents.lines.map((line) => {
    keyCounter += 1;
    return { key: `line-${keyCounter}`, ...line };
  });
}

function toNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Case-insensitive, whitespace-tolerant: "שעת עבודה " is "שעת עבודה". */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export function QuoteBuilder({
  clients,
  priceList,
  defaultValidUntil,
  defaultNotes,
  businessType,
  defaultWithVat,
  draft,
  prefill,
  initialClientId,
}: {
  clients: Client[];
  /** The owner's saved items, for the picker and the save-for-next-time offer. */
  priceList: PriceListItem[];
  defaultValidUntil: string;
  defaultNotes: string;
  businessType: BusinessType;
  defaultWithVat: boolean;
  /** Present when editing an existing quote. */
  draft?: QuoteDraft;
  /**
   * Contents carried over from another quote, when duplicating.
   *
   * Never combined with `draft`: one means "this quote already exists", the
   * other means "start a new one that looks like this". The client, the
   * validity and the status are deliberately not part of it.
   */
  prefill?: QuoteContents;
  /**
   * Preselects a client when arriving from that client's page.
   *
   * Deliberately its own prop rather than a one-field `draft`: `draft` means
   * "this is an edit", and the line below switches the form to
   * updateQuoteAction on its presence. Carrying a client id in it would turn a
   * new quote into an update of a quote that does not exist.
   */
  initialClientId?: string;
}) {
  const isEdit = Boolean(draft);

  /* Whichever quote's contents this form opened with, if any. Everything below
     reads this rather than testing for edit-versus-duplicate twice per field. */
  const contents: QuoteContents | undefined = draft ?? prefill;

  const [state, formAction] = useActionState(
    isEdit ? updateQuoteAction : createQuoteAction,
    EMPTY_FORM_STATE,
  );

  const [clientId, setClientId] = useState(
    draft?.clientId ??
      initialClientId ??
      (clients.length === 1 ? clients[0].id : ""),
  );
  const [lines, setLines] = useState<DraftLine[]>(() => linesFrom(contents));
  /*
   * A quote loaded from another one keeps its shape; a blank new quote starts
   * itemized, which is the only shape this form has ever had. The switch is one
   * tap away for the owner who wants the short version.
   */
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    contents && contents.lines.length === 0 ? "flat" : "itemized",
  );
  const [flatAmount, setFlatAmount] = useState(contents?.flatAmount ?? "");
  const [withVat, setWithVat] = useState(contents?.withVat ?? defaultWithVat);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(
    contents?.pricesIncludeVat ?? false,
  );
  /** True while the price list panel is open under the line items. */
  const [pickerOpen, setPickerOpen] = useState(false);

  /*
   * The "save this to your price list?" offer.
   *
   * Rules it has to obey, and the reason each piece of state exists:
   *
   *   offerKey       which line is being offered, so the prompt appears next to
   *                  the line it is about rather than floating at the bottom
   *   offerSpent     one offer per visit to this form. An owner writing a quote
   *                  is not here to curate a price list, and a prompt under
   *                  every line would be noise they learn to ignore
   *   savedNames     what this session already saved, so the same line cannot
   *                  be offered twice before the server round trip lands
   */
  const [offerKey, setOfferKey] = useState<string | null>(null);
  const [offerSpent, setOfferSpent] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [isSaving, startSaving] = useTransition();

  const isInPriceList = (description: string) =>
    priceList.some((item) => sameName(item.name, description)) ||
    savedNames.some((name) => sameName(name, description));

  /*
   * The line items section, so a blur can tell whether focus stayed inside it.
   * See considerOffer.
   */
  const linesSectionRef = useRef<HTMLElement>(null);

  /**
   * Considers a line for the offer once the owner has finished with it.
   *
   * Called on blur rather than on change: mid-typing, every line looks like a
   * new one, and an offer that appears on the third keystroke is a flicker.
   *
   * It only fires when focus moved to another control inside the line items,
   * and that condition is the important one. The offer is a block in the normal
   * flow, so showing it pushes everything below it down — including the save
   * button. Tapping save moves focus out of the price field, which fired this,
   * which grew the page between the finger going down and coming up, and the
   * tap landed on nothing. The owner pressed the biggest button on the screen
   * and the form did not submit.
   *
   * So: someone leaving the items section is on their way somewhere, and gets
   * no offer. Someone moving to the next field is still working, and does.
   */
  const considerOffer = (line: DraftLine, movingTo: EventTarget | null) => {
    if (offerSpent || offerKey) return;

    const next = movingTo instanceof Node ? movingTo : null;
    if (!next || !linesSectionRef.current?.contains(next)) return;

    const description = line.description.trim();
    const price = toNumber(line.unitPrice);
    if (!description || price <= 0) return;
    if (isInPriceList(description)) return;

    setOfferKey(line.key);
  };

  const dismissOffer = () => {
    setOfferKey(null);
    setOfferSpent(true);
  };

  const acceptOffer = (line: DraftLine) => {
    const description = line.description.trim();
    const price = toNumber(line.unitPrice);

    setSavedNames((current) => [...current, description]);
    setOfferKey(null);
    setOfferSpent(true);

    // Fire and forget. The quote is what matters here; if this fails the owner
    // has lost nothing they were trying to do.
    startSaving(() => {
      void rememberPriceItemAction(description, price);
    });
  };

  const clientSelectId = useId();
  /*
   * Prefix for the per-line field ids. useId supplies a value that matches
   * between the server and the client render.
   *
   * The rest of each id is the row's index, not its key. That looks backwards —
   * line.key is the thing that survives reordering and deletion — but the key is
   * drawn from a module-level counter, and a module-level counter does not mean
   * the same thing on both sides of a render. On the server it lives for the
   * life of the process and climbs with every request, so the first quote form
   * of the morning emitted line-1 and the tenth emitted line-10; in the browser
   * the module is loaded fresh and always starts at line-1. The ids therefore
   * never matched, and React reported a hydration mismatch on every screen that
   * renders this form.
   *
   * An id only has to be unique within one render, which an index is. The key
   * prop below is still line.key, so identity across reorders is unaffected.
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

  const isFlat = pricingMode === "flat";

  // The one number the rest of the form works from, whichever way it was
  // reached. Everything below here — VAT, the breakdown, the total — is
  // identical in both modes because it only ever sees this.
  const linesTotal = isFlat
    ? toNumber(flatAmount)
    : lines.reduce(
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
      <input type="hidden" name="pricingMode" value={pricingMode} />
      {/* Only the active mode's figures are submitted — the flat amount lives in
          a real field further down, which unmounts with its section. Sending
          both would let the server pick, and the server has no way to know which
          one the owner was looking at when they pressed save. */}
      {isFlat ? null : (
        <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      )}
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

        {/*
          The subject, next to the client rather than down with the notes: it
          is the heading of the document, and the two questions at the top of
          this form are now who it is for and what it is for.

          Optional. Every quote written before this field existed has none, and
          the client's page falls back to its old wording when it is empty.

          Except in flat mode, where it is the only description of the work the
          client will ever see, and the form says so rather than leaving them to
          discover it from the server's refusal.
        */}
        <TextField
          label="נושא ההצעה"
          name="title"
          maxLength={80}
          defaultValue={contents?.title ?? ""}
          placeholder="לדוגמה: שיפוץ חדר אמבטיה"
          hint={
            isFlat
              ? "בהצעה בלי פירוט זה מה שהלקוח יראה — כתוב מה העבודה."
              : "מופיע ככותרת ההצעה אצל הלקוח ובהודעת הוואטסאפ. לא חובה."
          }
        />
      </section>

      {/* ----------------------------------------------------- line items */}
      <section ref={linesSectionRef} className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">המחיר</h2>

        {/* Same segmented control as the VAT price mode below, because it is
            the same kind of question: two ways of saying the same amount. */}
        <div className="flex gap-2">
          {(
            [
              { mode: "flat", label: "סכום אחד" },
              { mode: "itemized", label: "פירוט פריטים" },
            ] as const
          ).map(({ mode, label }) => (
            <label
              key={mode}
              className={
                "flex h-control-sm flex-1 cursor-pointer items-center justify-center rounded-control border text-sm font-semibold transition-colors " +
                (pricingMode === mode
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface text-muted hover:bg-background")
              }
            >
              <input
                type="radio"
                name="pricingModeChoice"
                value={mode}
                checked={pricingMode === mode}
                onChange={() => setPricingMode(mode)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>

        {isFlat ? (
          <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-5 shadow-sm">
            <TextField
              label="סכום ההצעה"
              name="flatAmount"
              value={flatAmount}
              onChange={(event) => setFlatAmount(event.target.value)}
              inputMode="decimal"
              dir="ltr"
              className="text-start numeric"
              placeholder="0"
              hint="הלקוח יראה את נושא ההצעה ואת הסכום, בלי טבלת פריטים."
            />
          </div>
        ) : null}

        {isFlat ? null : lines.map((line, index) => {
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
                  onBlur={(event) => considerOffer(line, event.relatedTarget)}
                  placeholder="תיאור העבודה או החומר"
                  maxLength={300}
                  className={inputClasses}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label
                    htmlFor={`${lineFieldPrefix}-${index}-quantity`}
                    className="text-xs font-medium text-muted"
                  >
                    כמות
                  </label>
                  <input
                    id={`${lineFieldPrefix}-${index}-quantity`}
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
                    htmlFor={`${lineFieldPrefix}-${index}-unit-price`}
                    className="text-xs font-medium text-muted"
                  >
                    מחיר ליחידה
                  </label>
                  <input
                    id={`${lineFieldPrefix}-${index}-unit-price`}
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.key, { unitPrice: event.target.value })
                    }
                    onBlur={(event) => considerOffer(line, event.relatedTarget)}
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

              {/*
                The offer, attached to the line it is about. One sentence, two
                buttons, and it never comes back once answered — see the state
                it reads from at the top of this component.
              */}
              {offerKey === line.key ? (
                <div className="flex flex-col gap-2 rounded-tile bg-brand-soft p-3">
                  <p className="text-sm">
                    לשמור את &rdquo;{line.description.trim()}&ldquo; במחירון
                    לפעם הבאה?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => acceptOffer(line)}
                      disabled={isSaving}
                    >
                      שמירה במחירון
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={dismissOffer}
                    >
                      לא עכשיו
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {isFlat ? null : (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="dashed"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              + הוספת פריט
            </Button>

            {/*
              Only when there is something to pick. An owner who has never built
              a price list would get a button that opens an empty panel and
              explains itself — which is a worse introduction than the one the
              price list screen gives.
            */}
            {priceList.length > 0 ? (
              <Button
                type="button"
                variant="dashed"
                onClick={() => setPickerOpen((open) => !open)}
                aria-expanded={pickerOpen}
              >
                {pickerOpen ? "סגירת המחירון" : "בחירה מהמחירון"}
              </Button>
            ) : null}

            {pickerOpen ? (
              <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-card border border-border bg-surface p-3 shadow-sm">
                {priceList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        /*
                         * Copied by value, quantity 1. Changing the price here
                         * afterwards is a decision about this quote and must not
                         * travel back to the price list.
                         *
                         * The empty starter line is replaced rather than
                         * followed, so the first pick does not leave a blank row
                         * above it.
                         */
                        keyCounter += 1;
                        const picked: DraftLine = {
                          key: `line-${keyCounter}`,
                          description: item.name,
                          quantity: "1",
                          unitPrice: formatQuantity(Number(item.unit_price)),
                        };

                        setLines((current) => {
                          const isBlankStarter =
                            current.length === 1 &&
                            current[0].description.trim() === "" &&
                            current[0].unitPrice.trim() === "";
                          return isBlankStarter ? [picked] : [...current, picked];
                        });
                        setPickerOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-start transition-colors hover:bg-background"
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
        )}
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
          defaultValue={contents?.notes ?? defaultNotes}
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
