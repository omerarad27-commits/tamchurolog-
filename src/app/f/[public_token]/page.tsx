import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPublicIntake } from "@/lib/public-intake";

import { IntakeForm } from "./intake-form";

export async function generateMetadata({
  params,
}: PageProps<"/f/[public_token]">): Promise<Metadata> {
  const { public_token } = await params;
  const request = await loadPublicIntake(public_token);

  /*
   * A client's answers have no business being indexed, and this is the single
   * most important line in the file. Both branches carry it, including the
   * not-found branch.
   */
  const robots = { index: false, follow: false };

  if (!request) return { title: "שאלון", robots };

  const title = `כמה שאלות מ${request.businessName}`;
  const description = "כמה שאלות קצרות לפני הכנת הצעת מחיר.";

  return {
    title,
    description,
    robots,
    openGraph: {
      type: "website",
      locale: "he_IL",
      siteName: "תמחורולוג",
      title,
      description,
    },
  };
}

export default async function PublicIntakePage({
  params,
}: PageProps<"/f/[public_token]">) {
  const { public_token } = await params;
  const request = await loadPublicIntake(public_token);

  if (!request) notFound();

  return (
    <main className="mx-auto flex w-full max-w-form flex-col gap-5 px-5 py-8">
      <header>
        <p className="text-sm text-muted">{request.businessName}</p>
        <h1 className="mt-1 text-2xl font-bold">כמה שאלות לפני שמתמחרים</h1>
        {/* The invitation is dropped once the answers are in. "It takes less
            than a minute" above "you already answered" reads as a page that
            does not know what happened on it. */}
        {request.submittedAt ? null : (
          <p className="mt-2 text-sm text-muted">
            התשובות עוזרות להכין לך הצעת מחיר מדויקת. זה לוקח פחות מדקה.
          </p>
        )}
      </header>

      {/*
        A second visit to a request that was already answered shows the
        thank-you state rather than an empty form, so a re-tapped WhatsApp link
        cannot look like an invitation to answer again. The server refuses it
        regardless; this is so the client is never confused about whether it
        went through.
      */}
      {request.submittedAt ? (
        <div className="rounded-card border border-success/30 bg-success-soft p-6 text-center">
          <p className="text-lg font-bold text-success">כבר ענית, תודה!</p>
          <p className="mt-1 text-sm text-success">
            התשובות התקבלו. נחזור אליך עם הצעת מחיר.
          </p>
        </div>
      ) : (
        <IntakeForm token={public_token} questions={request.questions} />
      )}
    </main>
  );
}
