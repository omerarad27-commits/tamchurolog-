"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses } from "@/components/ui/text-field";

import {
  approveQuoteAction,
  declineQuoteAction,
  type DecisionState,
} from "./actions";

const INITIAL: DecisionState = { error: null, done: false };

/**
 * One-tap reasons. Free text is stored, so the owner reads a sentence rather
 * than decoding an enum, and we can change the options without a migration.
 */
const DECLINE_REASONS = [
  "המחיר גבוה מדי",
  "בחרתי ספק אחר",
  "העבודה כבר לא רלוונטית",
  "אחר",
];

type Mode = "idle" | "approving" | "declining";

export function QuoteDecision({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [approveState, approve] = useActionState(approveQuoteAction, INITIAL);
  const [declineState, decline] = useActionState(declineQuoteAction, INITIAL);

  if (mode === "idle") {
    return (
      <section className="print-hide flex flex-col gap-2">
        <Button type="button" onClick={() => setMode("approving")}>
          אישור ההצעה
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMode("declining")}
        >
          לא מעוניין/ת
        </Button>

        <p className="mt-1 px-1 text-xs leading-relaxed text-muted">
          בלחיצה על &quot;אישור ההצעה&quot; אני מאשר/ת את התנאים והמחירים
          המפורטים בהצעה זו מול {businessName}. תמחורולוג מספק את הפלטפורמה
          בלבד, אינו צד להתקשרות ואינו אחראי לביצועה.
        </p>
      </section>
    );
  }

  if (mode === "approving") {
    return (
      <section className="print-hide rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">אישור ההצעה</h2>

        <form action={approve} className="mt-3 flex flex-col gap-3" noValidate>
          <input type="hidden" name="token" value={token} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="signatureName" className="text-sm font-medium">
              אנא הקלד/י את שמך המלא לאישור
            </label>
            <input
              id="signatureName"
              name="signatureName"
              autoComplete="name"
              maxLength={80}
              required
              className={inputClasses}
            />
          </div>

          {approveState.error ? <Alert>{approveState.error}</Alert> : null}

          <SubmitButton pendingLabel="מאשר…">אישור סופי</SubmitButton>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("idle")}
          >
            חזרה
          </Button>

          <p className="px-1 text-xs leading-relaxed text-muted">
            בלחיצה על &quot;אישור סופי&quot; אני מאשר/ת את התנאים והמחירים
            המפורטים בהצעה זו מול {businessName}. תמחורולוג מספק את הפלטפורמה
            בלבד, אינו צד להתקשרות ואינו אחראי לביצועה.
          </p>
        </form>
      </section>
    );
  }

  return (
    <section className="print-hide rounded-card border border-border bg-surface p-5 shadow-sm">
      <h2 className="font-semibold">לא מעוניין/ת בהצעה</h2>
      <p className="mt-1 text-sm text-muted">
        אפשר לציין סיבה. זה עוזר ל{businessName} להשתפר, ולא חובה.
      </p>

      <form action={decline} className="mt-3 flex flex-col gap-3" noValidate>
        <input type="hidden" name="token" value={token} />

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">סיבת הדחייה</legend>
          {DECLINE_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex items-center gap-2 rounded-tile border border-border px-3 py-2.5 text-sm"
            >
              <input
                type="radio"
                name="reason"
                value={reason}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              {reason}
            </label>
          ))}
        </fieldset>

        {declineState.error ? <Alert>{declineState.error}</Alert> : null}

        <SubmitButton pendingLabel="שולח…">שליחת התשובה</SubmitButton>

        <Button type="button" variant="ghost" onClick={() => setMode("idle")}>
          חזרה
        </Button>
      </form>
    </section>
  );
}
