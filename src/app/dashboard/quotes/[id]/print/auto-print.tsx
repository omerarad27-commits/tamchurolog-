"use client";

import { useEffect, useRef } from "react";

/**
 * Names the document and opens the print dialog on arrival.
 *
 * The owner tapped "save as PDF" on the previous screen, so the dialog is what
 * they asked for; making them find the browser menu on the page it took them to
 * would be a step for nothing.
 *
 * The title is set and left set, unlike on the client's page: this route exists
 * only to be printed, so there is no later state where a filename in the tab
 * would be wrong.
 */
export function AutoPrint({ fileName }: { fileName: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    document.title = fileName;
    // After paint, so the logo and the fonts are in place before the browser
    // takes its snapshot of the page.
    const timer = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(timer);
  }, [fileName]);

  return null;
}
