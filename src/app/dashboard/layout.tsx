import { signOutAction } from "@/app/(auth)/actions";
import { requireBusiness } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { business, user } = await requireBusiness();
  const displayName = business.name.trim() || user.email || "העסק שלי";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-base font-bold text-brand-foreground"
          >
            ת
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              יציאה
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
