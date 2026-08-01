/**
 * Shown when a client opens a link that an edit has retired.
 *
 * Deliberately not a 404 and not an error: nothing went wrong, the quote was
 * simply replaced. The wording avoids implying the deal is off, because in
 * almost every case a corrected quote is on its way.
 */
export function RevokedQuote() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-tile bg-warning-soft text-2xl text-warning"
      >
        !
      </span>

      <h1 className="text-xl font-bold">ההצעה בוטלה</h1>

      <p className="text-sm leading-relaxed text-muted">
        ההצעה שהופיעה בקישור הזה עודכנה ואינה בתוקף יותר. בעל המקצוע אמור לשלוח
        לך קישור חדש עם ההצעה המעודכנת. אם לא קיבלת אותו, כדאי לפנות אליו ישירות.
      </p>
    </main>
  );
}
