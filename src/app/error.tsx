"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Catches anything a page throws. Without this the user gets Next's default
 * English error screen, which for a Hebrew RTL app aimed at tradespeople is
 * worse than useless.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keeps the digest in the server logs so a report can be traced.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="text-sm leading-relaxed text-muted">
        התקלה נרשמה אצלנו. אפשר לנסות שוב, ואם זה חוזר כדאי לרענן את הדף.
      </p>

      <Button type="button" onClick={reset}>
        נסה שוב
      </Button>

      {error.digest ? (
        <p className="numeric text-xs text-muted">קוד תקלה: {error.digest}</p>
      ) : null}
    </main>
  );
}
