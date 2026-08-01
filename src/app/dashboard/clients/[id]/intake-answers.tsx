import { formatDate } from "@/lib/format";
import { parseAnswers, parseQuestions } from "@/lib/intake";

export type IntakeRequestRow = {
  id: string;
  form_name: string;
  questions: unknown;
  answers: unknown;
  sent_at: string;
  submitted_at: string | null;
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
export function IntakeAnswersCard({ request }: { request: IntakeRequestRow }) {
  const questions = parseQuestions(request.questions);
  const answers = parseAnswers(request.answers);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{request.form_name}</span>
        {/* Digits isolated so the row stays right-aligned. */}
        <span className="shrink-0 text-xs text-muted">
          נשלח <span className="numeric">{formatDate(request.sent_at)}</span>
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
        <p className="mt-2 text-sm text-warning">טרם נענה</p>
      )}
    </div>
  );
}
