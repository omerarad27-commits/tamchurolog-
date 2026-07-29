export default function QuoteNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-tile bg-background text-2xl"
      >
        ?
      </span>
      <h1 className="text-xl font-bold">ההצעה לא נמצאה</h1>
      <p className="text-sm leading-relaxed text-muted">
        ייתכן שהקישור הועתק חלקית, או שההצעה הוסרה. כדאי לפנות ישירות לבעל
        המקצוע ולבקש קישור מעודכן.
      </p>
    </main>
  );
}
