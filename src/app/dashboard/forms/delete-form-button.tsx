"use client";

import { SubmitButton } from "@/components/ui/submit-button";

import { deleteFormAction } from "./actions";

/**
 * Deletion is irreversible and the button sits right under the save button on a
 * small screen, so it asks first. Once confirmed it goes through SubmitButton,
 * which disables itself so an impatient second tap cannot fire another delete.
 */
export function DeleteFormButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteFormAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `למחוק את "${name}"? שאלונים שכבר נשלחו והתשובות עליהם יישמרו.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="formId" value={id} />
      <SubmitButton variant="danger" pendingLabel="מוחק…">
        מחיקת השאלון
      </SubmitButton>
    </form>
  );
}
