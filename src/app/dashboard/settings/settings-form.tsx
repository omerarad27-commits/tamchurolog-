"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { BusinessTypePicker } from "@/components/ui/business-type-picker";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextArea } from "@/components/ui/textarea";
import { TextField } from "@/components/ui/text-field";
import { toBusinessType } from "@/lib/business-type";
import { formatPhoneForDisplay } from "@/lib/phone";
import { formatBytes, shrinkImage } from "@/lib/shrink-image";
import type { Business } from "@/lib/types";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import { updateBusinessAction } from "./actions";

const LOGO_MAX_BYTES = 3.5 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function SettingsForm({ business }: { business: Business }) {
  const [state, formAction] = useActionState(
    updateBusinessAction,
    EMPTY_FORM_STATE,
  );

  const [fileError, setFileError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  /**
   * Shrinks the picked image, then puts the smaller file back into the input so
   * the ordinary form submission carries it. Swapping the input's files rather
   * than intercepting the submit keeps useFormStatus working, which is what
   * disables the save button while the upload is in flight.
   */
  const handleFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    setFileError(null);
    setFileNote(null);
    if (!file) return;

    if (!LOGO_TYPES.includes(file.type)) {
      setFileError("סוג הקובץ אינו נתמך. אפשר להעלות PNG, JPG, WEBP או SVG.");
      input.value = "";
      return;
    }

    setProcessing(true);
    try {
      const result = await shrinkImage(file);

      if (result.shrunk) {
        try {
          const transfer = new DataTransfer();
          transfer.items.add(result.file);
          input.files = transfer.files;
          setFileNote(
            `התמונה הוקטנה מ־${formatBytes(result.originalBytes)} ל־${formatBytes(result.file.size)} לפני ההעלאה.`,
          );
        } catch {
          // Browser will not let us swap the selection. Upload the original and
          // fall back on the size check below.
        }
      }

      const finalFile = input.files?.[0];
      if (finalFile && finalFile.size > LOGO_MAX_BYTES) {
        setFileNote(null);
        setFileError(
          `הקובץ שוקל ${formatBytes(finalFile.size)} גם אחרי הקטנה, והמגבלה היא 3.5MB. כדאי לנסות תמונה אחרת.`,
        );
        input.value = "";
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        label="שם העסק"
        name="name"
        defaultValue={business.name}
        placeholder="לדוגמה: אינסטלציה כהן"
        hint="מופיע ללקוחות בראש הצעת המחיר."
        maxLength={80}
        required
      />

      <BusinessTypePicker
        defaultValue={toBusinessType(business.business_type)}
        label="סוג העסק — קובע אם הצעות חדשות כוללות מע״מ"
      />

      <TextField
        label="טלפון"
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        className="text-start"
        defaultValue={formatPhoneForDisplay(business.phone)}
        placeholder="054-1234567"
        hint="אפשר להזין בכל פורמט. אנחנו נסדר אותו."
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="logo" className="text-sm font-medium">
          לוגו
        </label>

        {business.logo_url ? (
          <div className="flex items-center gap-3">
            <Image
              src={business.logo_url}
              alt="הלוגו הנוכחי של העסק"
              width={56}
              height={56}
              className="h-14 w-14 rounded-tile border border-border bg-surface object-contain"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="removeLogo"
                className="h-4 w-4 accent-[color:var(--danger)]"
              />
              הסר את הלוגו
            </label>
          </div>
        ) : null}

        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(event) => void handleFile(event.currentTarget)}
          className="w-full rounded-control border border-border bg-surface p-2 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand"
        />
        {fileError ? (
          <Alert>{fileError}</Alert>
        ) : processing ? (
          <p className="text-xs text-muted">מעבד את התמונה…</p>
        ) : fileNote ? (
          <Alert tone="success">{fileNote}</Alert>
        ) : (
          <p className="text-xs text-muted">
            PNG, JPG, WEBP או SVG. תמונות גדולות יוקטנו אוטומטית.
          </p>
        )}
      </div>

      <TextArea
        label="תנאים והערות ברירת מחדל"
        name="defaultTerms"
        defaultValue={business.default_terms ?? ""}
        rows={5}
        placeholder="לדוגמה: המחירים אינם כוללים מע״מ. ההצעה בתוקף ל-14 יום."
        hint="יופיע בתחתית כל הצעת מחיר חדשה."
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">מטבע</span>
        <p className="rounded-tile border border-border bg-background px-3 py-3 text-sm text-muted">
          שקל חדש (₪) — קבוע בשלב זה.
        </p>
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SubmitButton
        pendingLabel="שומר…"
        disabled={processing}
        disabledLabel="מעבד תמונה…"
      >
        שמירה
      </SubmitButton>
    </form>
  );
}
