import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "הדף לא נמצא",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16 text-center">
      {/*
        The number was the h1 and the sentence was a paragraph, so the only
        heading on the page was "404". Swapped: the digits are decoration and
        carry aria-hidden, and the sentence a reader actually needs is the
        heading. Sizes are unchanged in both directions.

        No robots directive here on purpose. Next injects noindex for any page
        answering with a 404 status.
      */}
      <p
        aria-hidden="true"
        className="numeric text-4xl font-bold text-muted"
      >
        404
      </p>
      <div>
        <h1 className="text-xl font-bold">הדף לא נמצא</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ייתכן שהקישור שגוי או שהדף הוסר.
        </p>
      </div>

      <ButtonLink href="/">חזרה לדף הבית</ButtonLink>
    </main>
  );
}
