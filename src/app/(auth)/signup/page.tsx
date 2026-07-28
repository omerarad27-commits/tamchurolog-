import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "פתיחת חשבון | תמחורולוג",
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold">פתיחת חשבון</h1>
        <p className="mt-1 text-sm text-muted">
          דקה אחת, ואפשר לשלוח את הצעת המחיר הראשונה.
        </p>
      </div>

      <SignupForm />

      <p className="mt-5 text-center text-sm text-muted">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          התחברות
        </Link>
      </p>
    </>
  );
}
