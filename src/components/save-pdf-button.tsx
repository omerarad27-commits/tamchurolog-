"use client";

/**
 * "Save as PDF", which is the browser's own print dialog.
 *
 * No PDF is generated on the server, and that is a deliberate choice rather
 * than a shortcut. Producing one would mean shipping a headless browser or a
 * PDF library plus an embedded Hebrew font, and getting RTL, shaping and
 * mixed-direction numbers right a second time — after the page already does all
 * of that correctly. Every browser can already turn this page into a PDF; the
 * gap was only that nobody thinks to try.
 *
 * The filename comes from document.title, which is the one lever available
 * here. It is set for the duration of the dialog and put back afterwards, so a
 * client who cancels the dialog is not left with a tab named after a file.
 */
export function SavePdfButton({
  fileName,
  className = "",
}: {
  fileName: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const original = document.title;
        document.title = fileName;

        // Restoring after print() returns is not enough on every browser: some
        // run the dialog asynchronously. afterprint fires in both cases.
        const restore = () => {
          document.title = original;
          window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);

        window.print();
      }}
      className={
        "print-hide inline-flex h-control w-full items-center justify-center rounded-control border border-border bg-surface text-base font-semibold transition-colors hover:bg-background " +
        className
      }
    >
      שמירה כ־PDF
    </button>
  );
}
