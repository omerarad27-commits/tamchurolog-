import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "התחברות | תמחורולוג",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const redirectTo = typeof next === "string" ? next : "/dashboard";

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold">התחברות</h1>
        <p className="mt-1 text-sm text-muted">
          ברוך שובך. התחבר כדי לנהל את הצעות המחיר שלך.
        </p>
      </div>

      <LoginForm next={redirectTo} />

      <p className="mt-5 text-center text-sm text-muted">
        עדיין אין לך חשבון?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          פתיחת חשבון
        </Link>
      </p>
    </>
  );
}
