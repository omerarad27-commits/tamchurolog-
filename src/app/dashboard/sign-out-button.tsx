"use client";

import { useFormStatus } from "react-dom";

import { signOutAction } from "@/app/(auth)/actions";

function Inner() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
    >
      {pending ? "יוצא…" : "יציאה"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Inner />
    </form>
  );
}
