import type { Metadata } from "next";

import { safeRedirectPath } from "@/lib/safe-redirect";

import { FormBuilder } from "../form-builder";

export const metadata: Metadata = {
  title: "שאלון חדש | תמחורולוג",
};

export default async function NewFormPage({
  searchParams,
}: PageProps<"/dashboard/forms/new">) {
  /*
   * ?returnTo is set when the owner came here from a client's page to write a
   * questionnaire for that client. Narrowed here as well as in the action:
   * this value is rendered into the form, and a page should not put a string
   * it has not checked into its own markup.
   */
  const { returnTo } = await searchParams;
  const back = typeof returnTo === "string" && returnTo
    ? safeRedirectPath(returnTo)
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">שאלון חדש</h1>
      <FormBuilder returnTo={back} />
    </div>
  );
}
