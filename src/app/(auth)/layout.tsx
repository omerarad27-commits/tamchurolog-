import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="flex items-center gap-3 self-center">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-brand-foreground"
        >
          ת
        </span>
        <span className="text-xl font-bold">תמחורולוג</span>
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}
