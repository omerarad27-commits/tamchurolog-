import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16 text-center">
      <h1 className="numeric text-4xl font-bold text-muted">404</h1>
      <div>
        <p className="text-xl font-bold">הדף לא נמצא</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ייתכן שהקישור שגוי או שהדף הוסר.
        </p>
      </div>

      <ButtonLink href="/">חזרה לדף הבית</ButtonLink>
    </main>
  );
}
