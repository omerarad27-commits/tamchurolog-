import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { parseAnswers, parseQuestions } from "@/lib/intake";
import { SITE_URL } from "@/lib/site";
import { buildIntakeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export type IntakeRequestRow = {
  id: string;
  form_name: string;
  questions: unknown;
  answers: unknown;
  sent_at: string;
  submitted_at: string | null;
  public_token: string;
};

/**
 * One sent questionnaire, and what came back.
 *
 * The questions are read from the request rather than from the saved form, so
 * this shows what was actually asked even after the form was edited or deleted.
 *
 * Nothing here is calculated from the answers. This is what the owner reads while
 * deciding a price by hand, which is the whole point of the feature.
 */
export function IntakeAnswersCard({
  request,
  businessName,
  clientName,
  clientPhone,
}: {
  request: IntakeRequestRow;
  businessName: string;
  clientName: string;
  clientPhone: string | null;
}) {
  const questions = parseQuestions(request.questions);
  const answers = parseAnswers(request.answers);

  /*
   * The one and only place this link is now built. Preparing a link used to
   * live only in useActionState in <SendIntake>, which meant leaving that
   * screen - or the WhatsApp hand-off failing, or picking the wrong contact -
   * lost it for good, with no way back except inserting a second request row.
   * The token is on this row forever, so the link can always be rebuilt here.
   *
   * Server-rendered on purpose: a plain <a>, never a window.open after an
   * await, because browsers block that - the same reason every other
   * WhatsApp hand-off in this app is a real anchor.
   */
  const whatsapp = !request.submitted_at
    ? buildWhatsAppUrl(
        clientPhone,
        buildIntakeMessage({
          businessName,
          clientName,
          formUrl: `${SITE_URL}/f/${request.public_token}`,
        }),
      )
    : null;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{request.form_name}</span>
        {/*
          Digits isolated so the row stays right-aligned.

          "נשלח" claims the link left this device. sent_at is stamped by the
          database at INSERT time - the moment "הכנת קישור" is tapped, before
          any WhatsApp hand-off happens - so a request that was prepared and
          never actually sent would say "נשלח" forever and the owner would
          conclude the client is ignoring them. A submission is proof the link
          really reached someone, so only a submitted request gets to say
          "נשלח"; everything else says only what is true: the link was
          prepared.
        */}
        <span className="shrink-0 text-xs text-muted">
          {request.submitted_at ? "נשלח" : "קישור הוכן"}{" "}
          <span className="numeric">{formatDate(request.sent_at)}</span>
        </span>
      </div>

      {request.submitted_at ? (
        <dl className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {questions.map((question) => (
            <div key={question.id}>
              <dt className="text-sm text-muted">{question.prompt}</dt>
              <dd className="mt-0.5 font-medium whitespace-pre-wrap">
                {answers[question.id] ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-warning">טרם נענה</p>
          {whatsapp ? (
            <a
              href={whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "secondary" })}
            >
              שליחה בוואטסאפ
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
