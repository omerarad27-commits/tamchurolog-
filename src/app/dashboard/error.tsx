"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Scoped to the dashboard so the header and bottom navigation stay on screen:
 * a failed screen should not strand the owner with no way out.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-danger/30 bg-danger-soft p-5 text-center">
      <div>
        <h1 className="font-bold text-danger">לא הצלחנו לטעון את המסך</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ייתכן שהחיבור נפל לרגע. הנתונים שלך במקום.
        </p>
      </div>

      <Button type="button" onClick={reset}>
        טעינה מחדש
      </Button>

      <ButtonLink href="/dashboard" variant="secondary">
        חזרה להצעות
      </ButtonLink>

      {error.digest ? (
        <p className="numeric text-xs text-muted">קוד תקלה: {error.digest}</p>
      ) : null}
    </div>
  );
}
