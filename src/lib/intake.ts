/**
 * The shape of a questionnaire, and the rules that keep it that shape.
 *
 * Kept out of any "use server" file on purpose: those may only export async
 * functions, and both the Server Actions and the client-side builder need these
 * constants. Same reason src/lib/validation.ts exists.
 *
 * Everything here is pure, which is why it can be tested without a browser or a
 * database.
 */

/**
 * State for the dashboard "send questionnaire" flow and the public submit
 * flow, both driven by `useActionState` against a "use server" action.
 *
 * Kept here rather than beside the actions that use them: a "use server" file
 * may only export async functions, so these types and constants would break
 * the module at runtime (build/lint/typecheck do not catch this).
 */
export type IntakeSendState = {
  error: string | null;
  /** The token of the request just created, used to build the WhatsApp link. */
  token: string | null;
  /** The id of the form the token belongs to, so a stale link can be told apart from a fresh one. */
  formId: string | null;
};

export const EMPTY_INTAKE_SEND_STATE: IntakeSendState = {
  error: null,
  token: null,
  formId: null,
};

export type IntakeState = {
  error: string | null;
  done: boolean;
};

export const EMPTY_INTAKE_STATE: IntakeState = { error: null, done: false };

export const MAX_FORM_NAME_LENGTH = 60;
export const MAX_QUESTIONS = 20;
export const MAX_PROMPT_LENGTH = 200;
export const MAX_ANSWER_LENGTH = 1000;

export type IntakeQuestion =
  | { id: string; kind: "choice"; prompt: string; options: string[] }
  | { id: string; kind: "text"; prompt: string };

/**
 * Keyed by question id rather than by position, so an answer can never drift
 * onto the wrong question through reordering.
 */
export type IntakeAnswers = Record<string, string>;

/**
 * Narrows a jsonb column to the type above.
 *
 * The column is jsonb, which means Postgres guarantees it is valid JSON and
 * nothing else. Anything that does not match the shape is dropped rather than
 * throwing: a single malformed entry should not take down the page that renders
 * the other nineteen.
 */
export function parseQuestions(raw: unknown): IntakeQuestion[] {
  if (!Array.isArray(raw)) return [];

  const questions: IntakeQuestion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const id = candidate.id;
    const prompt = candidate.prompt;
    if (typeof id !== "string" || typeof prompt !== "string") continue;

    if (candidate.kind === "text") {
      questions.push({ id, kind: "text", prompt });
      continue;
    }

    if (candidate.kind === "choice" && Array.isArray(candidate.options)) {
      const options = candidate.options.filter(
        (option): option is string => typeof option === "string",
      );
      questions.push({ id, kind: "choice", prompt, options });
    }
  }
  return questions;
}

export function parseAnswers(raw: unknown): IntakeAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const answers: IntakeAnswers = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") answers[key] = value;
  }
  return answers;
}

/** Returns a Hebrew error message, or null when the form can be saved. */
export function validateQuestions(questions: IntakeQuestion[]): string | null {
  if (questions.length === 0) {
    return "יש להוסיף לפחות שאלה אחת לשאלון.";
  }
  if (questions.length > MAX_QUESTIONS) {
    return `שאלון יכול להכיל עד ${MAX_QUESTIONS} שאלות.`;
  }

  const seen = new Set<string>();
  for (const question of questions) {
    if (!question.prompt.trim()) {
      return "יש למלא את נוסח כל השאלות, או להסיר את הריקות.";
    }
    if (question.prompt.length > MAX_PROMPT_LENGTH) {
      return `נוסח שאלה ארוך מדי (עד ${MAX_PROMPT_LENGTH} תווים).`;
    }
    if (seen.has(question.id)) {
      return "אותה שאלה נוספה פעמיים.";
    }
    seen.add(question.id);

    if (question.kind === "choice" && question.options.length < 2) {
      return "שאלת בחירה חייבת לכלול לפחות שתי אפשרויות.";
    }
  }
  return null;
}

/**
 * Returns a Hebrew error message, or null when the answers can be stored.
 *
 * Runs on the server against the questions SNAPSHOTTED on the request, never
 * against anything the browser sent. A choice answer is checked against the
 * options that were actually offered, so a hand-edited request cannot store a
 * value the owner never listed.
 */
export function validateAnswers(
  questions: IntakeQuestion[],
  answers: IntakeAnswers,
): string | null {
  const asked = new Set(questions.map((question) => question.id));
  for (const key of Object.keys(answers)) {
    if (!asked.has(key)) return "התקבלה תשובה לשאלה שלא נשאלה.";
  }

  for (const question of questions) {
    const answer = answers[question.id];
    if (answer === undefined || !answer.trim()) {
      // Names the question rather than saying "some question is missing": on
      // a phone, with the alert rendered below five fieldsets, "יש לענות על
      // כל השאלות" gives a stranger who submitted once no way to find the
      // one field the message is actually about.
      return `יש לענות על השאלה: "${question.prompt}"`;
    }

    if (question.kind === "choice") {
      if (!question.options.includes(answer)) {
        return "נבחרה אפשרות שאינה קיימת.";
      }
    } else if (answer.length > MAX_ANSWER_LENGTH) {
      return `תשובה ארוכה מדי (עד ${MAX_ANSWER_LENGTH} תווים).`;
    }
  }
  return null;
}
