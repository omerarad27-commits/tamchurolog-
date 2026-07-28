"use client";

import { deleteClientAction } from "./actions";

/**
 * Deletion is irreversible and the button sits right under the save button on a
 * small screen, so it asks first.
 */
export function DeleteClientButton({
  id,
  fullName,
}: {
  id: string;
  fullName: string;
}) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `למחוק את ${fullName}? הפעולה אינה הפיכה.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="h-12 w-full rounded-xl border border-danger/30 text-base font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        מחיקת הלקוח
      </button>
    </form>
  );
}
