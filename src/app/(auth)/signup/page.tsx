import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "פתיחת חשבון | תמחורולוג",
};

/*
 * The nonce in the CSP is minted per request, and Next can only stamp it onto
 * script tags while server rendering one. This page was the only prerendered
 * route in the signed-out flow, which meant its scripts shipped without a nonce
 * and the policy blocked them — a signup form that could not hydrate.
 *
 * Rendering it per request costs nothing worth measuring: it is a static form
 * with no data fetching, and it is visited once per customer.
 */
export const dynamic = "force-dynamic";

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
