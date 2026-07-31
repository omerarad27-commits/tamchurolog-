"use server";

import { revalidatePath } from "next/cache";

import { parseAnswers, validateAnswers } from "@/lib/intake";
import { loadPublicIntake, submitIntake } from "@/lib/public-intake";

/*
 * Public action. There is no session here by design: whoever holds the link is
 * the client, and asking them to open an account to answer four questions would
 * defeat the point.
 *
 * What keeps this safe:
 *   - the token is shape-checked before it reaches the database
 *   - the answers are validated against the questions stored ON THE ROW, never
 *     against anything the browser sent alongside them
 *   - the database function only writes while submitted_at is null, so a
 *     replayed or double-tapped request cannot overwrite an earlier answer
 *   - nothing here returns any data; it only reports what happened
 */

const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export type IntakeState = {
  error: string | null;
  done: boolean;
};

export const EMPTY_INTAKE_STATE: IntakeState = { error: null, done: false };

export async function submitIntakeAction(
  _previousState: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const token = String(formData.get("token") ?? "");
  if (!TOKEN_PATTERN.test(token)) {
    return { error: "הקישור אינו תקין.", done: false };
  }

  const request = await loadPublicIntake(token);
  if (!request) return { error: "הקישור אינו תקין.", done: false };

  if (request.submittedAt) {
    revalidatePath(`/f/${token}`);
    return { error: null, done: true };
  }

  /*
   * Built from the questions on the row, not from the form's field names, so a
   * hand-edited request cannot introduce a key that was never asked. A missing
   * field becomes an empty answer, which validateAnswers rejects with a message
   * the client can act on.
   */
  const answers = parseAnswers(
    Object.fromEntries(
      request.questions.map((question) => [
        question.id,
        String(formData.get(question.id) ?? "").trim(),
      ]),
    ),
  );

  const problem = validateAnswers(request.questions, answers);
  if (problem) return { error: problem, done: false };

  const outcome = await submitIntake(token, answers);
  if (outcome === "error") {
    return { error: "משהו השתבש. נסו שוב בעוד רגע.", done: false };
  }

  revalidatePath(`/f/${token}`);
  return { error: null, done: true };
}
