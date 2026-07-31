# Intake Forms and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner builds a short questionnaire once, sends it to a client on WhatsApp, reads the answers on the client's card, and is told in-app when a client submits one or approves a quote.

**Architecture:** Two new tables (`intake_forms`, `intake_requests`) plus `notifications`, all scoped by `business_id` under the same RLS pattern every existing table uses. Questions are jsonb and are snapshotted into each request at send time. The public client page `/f/[public_token]` mirrors `/q/[public_token]` exactly: read on the server with the service-role key on an exact token match, written through a `security definer` function. Ships in five slices with approval between each; only the last touches code that already works.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack, Server Actions), React 19, Supabase Postgres, Tailwind v4, Playwright for verification.

## Global Constraints

- **Surgical changes only.** No refactoring of code that already works, no renames, no folder reorganisation, no formatter runs on untouched files.
- **No new dependencies.** Nothing added to `package.json` except `verify:*` scripts.
- **Migrations are pure ASCII with `/* */` block comments only** — never `--`, because an editor can autocorrect a double dash into an en dash and silently comment out a statement. No Hebrew literal may appear in a migration.
- The **service_role key** may only be reached through `src/lib/supabase/admin.ts` (marked `server-only`). It must never appear in client code or in a `NEXT_PUBLIC_` variable.
- **No browser Supabase client.** All database access is server-side.
- **Do not change** the session cookie options, existing RLS policies, the existing schema, the httpOnly cookie, the 32-hex token scheme, `/q`'s noindex, or the colour tokens.
- **No image upload** anywhere in this feature. **No automatic pricing** from answers.
- **No analytics, third-party scripts or external fonts** on any public page.
- **Client IP addresses are never surfaced to the owner.**
- Every migration is delivered to the user as SQL to paste into the Supabase SQL editor. **The agent cannot run it.** Ask the user to run it and confirm before continuing.
- **`npm run lint` must be run bare.** Piping it (`| tail`) returns the pipe's exit code and hides a failure.
- Tokens are `replace(gen_random_uuid()::text, '-', '')` — 32 lowercase hex — with a `/^[0-9a-f]{32}$/` shape check before the value ever reaches the database.
- Hebrew UI copy throughout. Verification scripts print **English** output — Windows terminals mangle Hebrew.
- After every slice: `npm run lint`, `npm run typecheck`, `npm run build`, and the full existing verify suite (`csp`, `redirect`, `quote`, `seo`, `a11y`, `auth`, `settings`, `bidi`, `contact`, `client-hub`, `landing`) must pass. Then commit, push, and re-verify against production.

## Deviations from the spec, and why

1. **Reading the public page.** The spec said `/q` reads through a `security definer` function. It does not — `src/lib/public-quote.ts` reads with the service-role admin client on an exact token match, and uses a definer function only for writes. This plan mirrors the real pattern. The spec has been corrected.
2. **Notification wording.** The spec stored a Hebrew `title`. Migrations here are pure ASCII, and these rows are written by SQL functions, so a Hebrew literal cannot appear. The table snapshots `subject_name` and `quote_number` instead, and the sentence is composed in TypeScript at render time — same immunity to a later deletion, and the copy stays where it can be changed without a migration. The spec has been corrected.
3. **The nav tab moves to slice 1.** The spec put it in slice 2. A form library the owner cannot reach is not something they can approve. It is one entry in one array.

---

## File Structure

**Slice 1 — the library**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0013_intake_forms.sql` | create both tables, their indexes and their RLS |
| `src/lib/intake.ts` | question/answer types, limits, and pure validation. No `"use server"`, so constants can be imported by client components |
| `src/lib/intake-bank.ts` | the two built-in questions, as constants |
| `src/app/dashboard/forms/page.tsx` | the library listing |
| `src/app/dashboard/forms/actions.ts` | create, update, delete |
| `src/app/dashboard/forms/form-builder.tsx` | the builder, one client component used by both new and edit |
| `src/app/dashboard/forms/delete-form-button.tsx` | delete with confirmation |
| `src/app/dashboard/forms/new/page.tsx` | wraps the builder with no draft |
| `src/app/dashboard/forms/[id]/page.tsx` | loads a form and wraps the builder with a draft |
| `src/app/dashboard/nav.tsx` | **modify**: one new tab |
| `scripts/verify-intake-unit.mjs` | unit tests for `src/lib/intake.ts` |
| `scripts/verify-forms.mjs` | browser test of the library and builder |

**Slice 2 — sending and the client's page**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0014_intake_submit.sql` | `submit_intake_request` definer function |
| `src/lib/public-intake.ts` | `loadPublicIntake` / `submitIntake`, the mirror of `public-quote.ts` |
| `src/app/dashboard/clients/[id]/send-intake.tsx` | pick a form, then send |
| `src/app/dashboard/clients/[id]/intake-actions.ts` | `createIntakeRequestAction` |
| `src/app/f/[public_token]/page.tsx` | the client's page |
| `src/app/f/[public_token]/intake-form.tsx` | the answer form |
| `src/app/f/[public_token]/actions.ts` | `submitIntakeAction` |
| `src/lib/whatsapp.ts` | **modify**: add `buildIntakeMessage` |
| `src/proxy.ts` | **modify**: `/f/` joins `/q/`'s early return |
| `src/app/robots.ts` | **modify**: `/f/` joins the disallow list |
| `next.config.ts` | **modify**: `no-referrer` for `/f/:public_token*` |
| `scripts/verify-intake.mjs` | send, answer, submit, re-submit refused, headers |

**Slice 3 — the answers**

| File | Responsibility |
| --- | --- |
| `src/app/dashboard/clients/[id]/intake-answers.tsx` | one request rendered as a card |
| `src/app/dashboard/clients/[id]/page.tsx` | **modify**: load requests, render the section |

**Slice 4 — notifications**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0015_notifications.sql` | the table, its RLS, and `submit_intake_request` replaced to insert one |
| `src/lib/notifications.ts` | load, count, mark read, and the Hebrew wording |
| `src/app/dashboard/notification-bell.tsx` | the unread count in the header |
| `src/app/dashboard/notifications/page.tsx` | the list; opening it marks all read |
| `src/app/dashboard/layout.tsx` | **modify**: the bell |
| `scripts/verify-notifications.mjs` | raised, scoped per business, marked read |

**Slice 5 — the quote trigger**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0016_quote_approved_notification.sql` | `record_quote_decision` replaced |
| `scripts/verify-quote-approval.mjs` | the existing behaviour, asserted before and after |

---

## Task 1: The tables

**Files:**
- Create: `supabase/migrations/0013_intake_forms.sql`

**Interfaces:**
- Consumes: `public.businesses(id)`, `public.clients(id)` — both exist.
- Produces: tables `public.intake_forms` and `public.intake_requests` with the columns named below. Every later task depends on these exact column names.

- [ ] **Step 1: Write the migration**

Follow `0001_auth_businesses_clients.sql` exactly for the RLS shape: prove ownership by joining back to `businesses`, and wrap `auth.uid()` in a subselect so Postgres evaluates it once per query rather than once per row.

```sql
/*
  Intake forms: a saved questionnaire, and one sent copy of it.

  Two tables, and the split between them is the whole design:

  intake_forms is the owner's library. It is edited freely.

  intake_requests is one questionnaire sent to one client. It carries its own
  COPY of the questions, taken at send time. Editing a saved form afterwards
  therefore cannot change a link already in a client's hands, and the answers
  stay attached to the questions that were actually asked. This is the same
  principle that freezes a sent quote.

  form_id is kept only so the owner can see which saved form a request came
  from. on delete set null means deleting a form never deletes the answers it
  produced.

  Questions and answers are jsonb rather than normalised tables because nothing
  ever queries inside them: they are rendered in order and read by a human.
  quote_line_items is normalised because its rows are summed and recalculated.
  There is no arithmetic here.

  Security: there is NO anon policy on either table, and none is added here.
  The public page is rendered on the server with the service_role key filtering
  on an exact public_token match, exactly as the quote page is, so the
  PostgREST API stays completely closed to anonymous callers.

  Block comments only, so no editor can autocorrect a double dash.
*/

/* ========================= intake_forms ========================= */

create table if not exists public.intake_forms (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  questions    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists intake_forms_business_id_idx
  on public.intake_forms (business_id, created_at desc);

alter table public.intake_forms enable row level security;

drop policy if exists intake_forms_select_own on public.intake_forms;
create policy intake_forms_select_own on public.intake_forms
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_insert_own on public.intake_forms;
create policy intake_forms_insert_own on public.intake_forms
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_update_own on public.intake_forms;
create policy intake_forms_update_own on public.intake_forms
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_delete_own on public.intake_forms;
create policy intake_forms_delete_own on public.intake_forms
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ======================== intake_requests ======================== */

create table if not exists public.intake_requests (
  id            uuid not null primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  form_id       uuid references public.intake_forms (id) on delete set null,
  client_id     uuid not null references public.clients (id) on delete cascade,
  form_name     text not null default '',
  questions     jsonb not null default '[]'::jsonb,
  answers       jsonb,
  public_token  text not null unique
                default replace(gen_random_uuid()::text, '-', ''),
  sent_at       timestamptz not null default now(),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);

/*
  form_name is snapshotted alongside the questions for the same reason: the
  client hub says which questionnaire this was, and renaming the saved form
  must not rewrite history.
*/

create index if not exists intake_requests_client_id_idx
  on public.intake_requests (client_id, sent_at desc);

create index if not exists intake_requests_business_id_idx
  on public.intake_requests (business_id, sent_at desc);

create index if not exists intake_requests_public_token_idx
  on public.intake_requests (public_token);

alter table public.intake_requests enable row level security;

drop policy if exists intake_requests_select_own on public.intake_requests;
create policy intake_requests_select_own on public.intake_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_requests_insert_own on public.intake_requests;
create policy intake_requests_insert_own on public.intake_requests
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_requests_delete_own on public.intake_requests;
create policy intake_requests_delete_own on public.intake_requests
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/*
  Deliberately no update policy for authenticated users. The only thing that
  ever updates this table is the submission, which is a client with no account
  and runs through a security definer function in the next migration. An owner
  who could update the row could edit their client's answers.
*/
```

- [ ] **Step 2: Check it is ASCII-only**

Run:

```bash
node -e "const s=require('fs').readFileSync('supabase/migrations/0013_intake_forms.sql','utf8');const bad=[...s].filter(c=>c.charCodeAt(0)>126);console.log(bad.length?'NON-ASCII: '+JSON.stringify(bad):'ascii ok');console.log(s.includes('--')?'FOUND DOUBLE DASH':'no double dash')"
```

Expected: `ascii ok` and `no double dash`.

- [ ] **Step 3: Hand it to the user**

Print the full SQL and ask them to run it in the Supabase SQL editor. **Wait for confirmation.** Do not continue on the assumption that it ran.

- [ ] **Step 4: Confirm the tables landed**

Run:

```bash
node --env-file=.env.local -e "
const {createClient}=require('@supabase/supabase-js');
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
(async()=>{for(const t of ['intake_forms','intake_requests']){const {error}=await a.from(t).select('id').limit(1);console.log(t, error?'MISSING: '+error.message:'ok');}})()
"
```

Expected: `intake_forms ok` and `intake_requests ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_intake_forms.sql
git commit -m "Intake forms: tables and RLS"
```

---

## Task 2: The question bank and validation

**Files:**
- Create: `src/lib/intake-bank.ts`
- Create: `src/lib/intake.ts`
- Create: `scripts/verify-intake-unit.mjs`
- Modify: `package.json` (one script line)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type IntakeQuestion = { id: string; kind: "choice"; prompt: string; options: string[] } | { id: string; kind: "text"; prompt: string }`
  - `type IntakeAnswers = Record<string, string>`
  - `INTAKE_BANK: readonly { key: string; prompt: string; options: string[] }[]`
  - `parseQuestions(raw: unknown): IntakeQuestion[]`
  - `parseAnswers(raw: unknown): IntakeAnswers`
  - `validateQuestions(questions: IntakeQuestion[]): string | null`
  - `validateAnswers(questions: IntakeQuestion[], answers: IntakeAnswers): string | null`
  - `MAX_FORM_NAME_LENGTH`, `MAX_QUESTIONS`, `MAX_PROMPT_LENGTH`, `MAX_ANSWER_LENGTH`

- [ ] **Step 1: Write the bank**

`src/lib/intake-bank.ts` — the wording is copied from the user's request verbatim. Do not paraphrase it.

```ts
/**
 * The built-in questions.
 *
 * Constants rather than database rows: these are part of the product, not user
 * data, so a third question later is a code change with no migration and no
 * backfill.
 *
 * The wording is COPIED into a form when it is built, never referenced. Editing
 * this file therefore never rewrites questionnaires that already exist — the
 * same rule that governs everything else in this feature.
 */
export type BankQuestion = {
  /** Becomes the question id inside a form, so it is stable and readable. */
  key: string;
  prompt: string;
  options: string[];
};

export const INTAKE_BANK: readonly BankQuestion[] = [
  {
    key: "floor_elevator",
    prompt: "האם מדובר בבניין ללא מעלית, ואם כן באיזו קומה?",
    options: ["לא", "1", "2", "3", "4"],
  },
  {
    key: "parking",
    prompt: "האם יש חנייה זמינה ליד המבנה או אזור פריקה נוח?",
    options: ["חנייה חופשית", "בעייתי מאוד לחנות", "חניה קצת רחוקה מהמבנה"],
  },
] as const;

export const BANK_KEYS = new Set(INTAKE_BANK.map((q) => q.key));
```

- [ ] **Step 2: Write the failing unit tests**

`scripts/verify-intake-unit.mjs`. Follow `scripts/verify-bidi.mjs`: plain node, English output, non-zero exit on failure.

```js
/**
 * Unit tests for the intake question and answer rules.
 *
 * These run without a browser or a database because they are pure functions,
 * and because every one of them is a rule that protects the database from
 * something a client typed.
 *
 * Run:  npm run verify:intake-unit
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import {
  MAX_ANSWER_LENGTH,
  parseAnswers,
  parseQuestions,
  validateAnswers,
  validateQuestions,
} from "../src/lib/intake.ts";

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const choice = {
  id: "floor_elevator",
  kind: "choice",
  prompt: "קומה?",
  options: ["לא", "1", "2"],
};
const text = { id: "text-1", kind: "text", prompt: "פרטים" };

console.log("\nIntake validation\n");

/* ------------------------------------------------------- questions */
check("a form with no questions is rejected", validateQuestions([]) !== null);
check("a valid form is accepted", validateQuestions([choice, text]) === null);
check(
  "an empty prompt is rejected",
  validateQuestions([{ ...text, prompt: "  " }]) !== null,
);
check(
  "duplicate ids are rejected",
  validateQuestions([text, { ...text }]) !== null,
);
check(
  "a choice question with fewer than two options is rejected",
  validateQuestions([{ ...choice, options: ["לא"] }]) !== null,
);

/* --------------------------------------------------------- answers */
check(
  "a complete answer set is accepted",
  validateAnswers([choice, text], { floor_elevator: "1", "text-1": "כן" }) === null,
);
check(
  "an unanswered question is rejected",
  validateAnswers([choice, text], { floor_elevator: "1" }) !== null,
);
check(
  "a choice value outside the options is rejected",
  validateAnswers([choice], { floor_elevator: "17" }) !== null,
);
check(
  "an over-long free text answer is rejected",
  validateAnswers([text], { "text-1": "x".repeat(MAX_ANSWER_LENGTH + 1) }) !== null,
);
check(
  "an answer to a question that was not asked is rejected",
  validateAnswers([text], { "text-1": "כן", ghost: "?" }) !== null,
);

/* ---------------------------------------------------------- parsing */
check("parseQuestions survives junk", parseQuestions("nonsense").length === 0);
check("parseQuestions drops malformed entries", parseQuestions([{ id: 1 }]).length === 0);
check(
  "parseQuestions keeps well-formed entries",
  parseQuestions([choice]).length === 1,
);
check("parseAnswers survives null", Object.keys(parseAnswers(null)).length === 0);
check(
  "parseAnswers drops non-string values",
  parseAnswers({ a: "ok", b: 5 }).b === undefined,
);

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 3: Add the script and run it to watch it fail**

In `package.json`, beside the other `verify:*` entries. The flags match `verify:contact`, which is the existing precedent for a node-run test that imports a `@/`-aliased TypeScript module:

```json
"verify:intake-unit": "node --experimental-strip-types --import ./scripts/register-ts-alias.mjs scripts/verify-intake-unit.mjs",
```

Run: `npm run verify:intake-unit`
Expected: FAIL — `Cannot find module '../src/lib/intake.ts'`.

- [ ] **Step 4: Write the module**

`src/lib/intake.ts`:

```ts
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
      return "יש לענות על כל השאלות.";
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
```

- [ ] **Step 5: Run the tests**

Run: `npm run verify:intake-unit`
Expected: `15/15 checks passed.`

- [ ] **Step 6: Commit**

```bash
git add src/lib/intake.ts src/lib/intake-bank.ts scripts/verify-intake-unit.mjs package.json
git commit -m "Intake forms: question bank and validation"
```

---

## Task 3: The form library and builder

**Files:**
- Create: `src/app/dashboard/forms/actions.ts`
- Create: `src/app/dashboard/forms/form-builder.tsx`
- Create: `src/app/dashboard/forms/delete-form-button.tsx`
- Create: `src/app/dashboard/forms/page.tsx`
- Create: `src/app/dashboard/forms/new/page.tsx`
- Create: `src/app/dashboard/forms/[id]/page.tsx`
- Modify: `src/app/dashboard/nav.tsx` (the `TABS` array only)
- Create: `scripts/verify-forms.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `IntakeQuestion`, `validateQuestions`, `parseQuestions`, `MAX_FORM_NAME_LENGTH`, `MAX_PROMPT_LENGTH` from `@/lib/intake`; `INTAKE_BANK` from `@/lib/intake-bank`; `requireBusiness` from `@/lib/auth`; `FormState`, `EMPTY_FORM_STATE` from `@/lib/validation`.
- Produces: `createFormAction`, `updateFormAction`, `deleteFormAction`; `<FormBuilder draft?={FormDraft} />` where `FormDraft = { id: string; name: string; questions: IntakeQuestion[] }`.

- [ ] **Step 1: Write the actions**

`src/app/dashboard/forms/actions.ts`. The questions travel as one hidden JSON field, exactly as the quote builder ships its line items.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import {
  MAX_FORM_NAME_LENGTH,
  parseQuestions,
  validateQuestions,
  type IntakeQuestion,
} from "@/lib/intake";
import type { FormState } from "@/lib/validation";

/**
 * Reads the name and the questions out of the form.
 *
 * The questions arrive as one JSON string in a hidden field, the same way the
 * quote builder ships its line items. Everything in it is re-validated here:
 * the browser is where it was assembled, so nothing it says is trusted.
 */
function readForm(
  formData: FormData,
): { name: string; questions: IntakeQuestion[] } | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "יש לתת שם לשאלון." };
  if (name.length > MAX_FORM_NAME_LENGTH) {
    return { error: `שם השאלון ארוך מדי (עד ${MAX_FORM_NAME_LENGTH} תווים).` };
  }

  let raw: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "שמירת השאלון נכשלה. נסה שוב." };
  }

  const questions = parseQuestions(raw);
  const problem = validateQuestions(questions);
  if (problem) return { error: problem };

  return { name, questions };
}

export async function createFormAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  const { error } = await supabase.from("intake_forms").insert({
    business_id: business.id,
    name: parsed.name,
    questions: parsed.questions,
  });

  if (error) return { error: "שמירת השאלון נכשלה. נסה שוב.", success: null };

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

export async function updateFormAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("formId") ?? "");
  if (!id) return { error: "השאלון לא נמצא.", success: null };

  const parsed = readForm(formData);
  if ("error" in parsed) return { error: parsed.error, success: null };

  // business_id is matched as well as id. RLS already blocks other tenants;
  // this keeps the intent visible at the call site.
  const { error } = await supabase
    .from("intake_forms")
    .update({
      name: parsed.name,
      questions: parsed.questions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) return { error: "עדכון השאלון נכשל. נסה שוב.", success: null };

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}

export async function deleteFormAction(formData: FormData): Promise<void> {
  const { supabase, business } = await requireBusiness();

  const id = String(formData.get("formId") ?? "");
  if (!id) redirect("/dashboard/forms");

  /*
   * Requests already sent survive this: intake_requests.form_id is
   * "on delete set null", and every request carries its own copy of the
   * questions and the form name. Deleting a form retires it from the library
   * without erasing what a client already answered.
   */
  await supabase
    .from("intake_forms")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}
```

- [ ] **Step 2: Write the builder**

`src/app/dashboard/forms/form-builder.tsx`. Modelled on the quote builder's line-item list — same add/remove shape, same hidden JSON field, same `SubmitButton`.

```tsx
"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses, TextField } from "@/components/ui/text-field";
import {
  MAX_FORM_NAME_LENGTH,
  MAX_PROMPT_LENGTH,
  type IntakeQuestion,
} from "@/lib/intake";
import { INTAKE_BANK } from "@/lib/intake-bank";
import { EMPTY_FORM_STATE } from "@/lib/validation";

import { createFormAction, updateFormAction } from "./actions";

export type FormDraft = {
  id: string;
  name: string;
  questions: IntakeQuestion[];
};

type FreeTextLine = { id: string; prompt: string };

/**
 * Free-text ids are "text-N" with N above every N already in the draft, so
 * editing a saved form never reuses an id that an existing question holds.
 * Bank questions use their bank key as their id, which is stable by
 * construction.
 */
function nextTextId(existing: { id: string }[]): string {
  let highest = 0;
  for (const question of existing) {
    const match = /^text-(\d+)$/.exec(question.id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `text-${highest + 1}`;
}

export function FormBuilder({ draft }: { draft?: FormDraft }) {
  const isEdit = Boolean(draft);

  const [state, formAction] = useActionState(
    isEdit ? updateFormAction : createFormAction,
    EMPTY_FORM_STATE,
  );

  const [selectedBank, setSelectedBank] = useState<string[]>(() =>
    INTAKE_BANK.filter((bank) =>
      draft?.questions.some((question) => question.id === bank.key),
    ).map((bank) => bank.key),
  );

  const [freeText, setFreeText] = useState<FreeTextLine[]>(() =>
    (draft?.questions ?? [])
      .filter((question) => question.kind === "text")
      .map((question) => ({ id: question.id, prompt: question.prompt })),
  );

  const fieldPrefix = useId();

  /*
   * The bank questions come first and in bank order, so the form a client sees
   * matches the order the builder shows regardless of the order they were
   * ticked in.
   */
  const questions: IntakeQuestion[] = [
    ...INTAKE_BANK.filter((bank) => selectedBank.includes(bank.key)).map(
      (bank): IntakeQuestion => ({
        id: bank.key,
        kind: "choice",
        prompt: bank.prompt,
        options: [...bank.options],
      }),
    ),
    ...freeText.map((line): IntakeQuestion => ({
      id: line.id,
      kind: "text",
      prompt: line.prompt,
    })),
  ];

  const toggleBank = (key: string) => {
    setSelectedBank((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  return (
    <form action={formAction} className="flex w-full max-w-form flex-col gap-5" noValidate>
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />
      {draft ? <input type="hidden" name="formId" value={draft.id} /> : null}

      <section className="rounded-card border border-border bg-surface p-5 shadow-sm">
        <TextField
          label="שם השאלון"
          name="name"
          defaultValue={draft?.name ?? ""}
          maxLength={MAX_FORM_NAME_LENGTH}
          placeholder="לדוגמה: שאלון שיפוץ מקלחת"
          hint="השם הזה נראה רק לך, כדי למצוא את השאלון ברשימה."
        />
      </section>

      {/* ------------------------------------------------ the built-in bank */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-bold">שאלות מוכנות</h2>
        <p className="text-sm text-muted">
          שאלות שחוזרות כמעט בכל עבודה. סמן את מה שרלוונטי.
        </p>

        {INTAKE_BANK.map((bank) => (
          <label
            key={bank.key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-tile bg-background p-3"
          >
            <span>
              <span className="font-medium">{bank.prompt}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {bank.options.join(" · ")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={selectedBank.includes(bank.key)}
              onChange={() => toggleBank(bank.key)}
              className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--brand)]"
            />
          </label>
        ))}
      </section>

      {/* -------------------------------------------------- free text ones */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">שאלות משלך</h2>

        {freeText.map((line, index) => (
          <div
            key={line.id}
            className="flex items-start gap-2 rounded-card border border-border bg-surface p-4 shadow-sm"
          >
            <span className="numeric mt-3 text-sm font-semibold text-muted">
              {index + 1}.
            </span>
            <input
              id={`${fieldPrefix}-${line.id}`}
              aria-label={`שאלה ${index + 1}`}
              value={line.prompt}
              onChange={(event) =>
                setFreeText((current) =>
                  current.map((item) =>
                    item.id === line.id
                      ? { ...item, prompt: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="לדוגמה: מה גודל החדר במטרים?"
              maxLength={MAX_PROMPT_LENGTH}
              className={inputClasses}
            />
            <button
              type="button"
              onClick={() =>
                setFreeText((current) =>
                  current.filter((item) => item.id !== line.id),
                )
              }
              aria-label={`הסר שאלה ${index + 1}`}
              className="mt-0.5 h-control w-11 shrink-0 rounded-lg text-danger transition-colors hover:bg-danger-soft"
            >
              ✕
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="dashed"
          onClick={() =>
            setFreeText((current) => [
              ...current,
              { id: nextTextId([...questions, ...current]), prompt: "" },
            ])
          }
        >
          + הוספת שאלה
        </Button>
      </section>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <SubmitButton pendingLabel="שומר…">
          {isEdit ? "שמירת השינויים" : "שמירת השאלון"}
        </SubmitButton>
        <ButtonLink href="/dashboard/forms" variant="secondary">
          ביטול
        </ButtonLink>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write the delete button**

`src/app/dashboard/forms/delete-form-button.tsx`. Read `src/app/dashboard/clients/delete-client-button.tsx` first and mirror its confirmation pattern rather than inventing a second one; the code below is the intended result, but if that file differs, follow it.

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

import { deleteFormAction } from "./actions";

export function DeleteFormButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
        מחיקת השאלון
      </Button>
    );
  }

  return (
    <form action={deleteFormAction} className="flex flex-col gap-2">
      <input type="hidden" name="formId" value={id} />
      <p className="text-sm text-muted">
        למחוק את &quot;{name}&quot;? שאלונים שכבר נשלחו והתשובות עליהם יישמרו.
      </p>
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingLabel="מוחק…">
          כן, למחוק
        </SubmitButton>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write the three pages**

`src/app/dashboard/forms/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { parseQuestions } from "@/lib/intake";

export const metadata: Metadata = {
  title: "שאלונים | תמחורולוג",
};

export default async function FormsPage() {
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const forms = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">שאלונים</h1>
        <p className="mt-1 text-sm text-muted">
          שאלון קצר שנשלח ללקוח בוואטסאפ, כדי לדעת מה צריך לפני שמתמחרים.
        </p>
      </div>

      <ButtonLink href="/dashboard/forms/new">שאלון חדש</ButtonLink>

      {forms.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">
          עדיין לא יצרת שאלון.
        </p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {forms.map((form) => {
            const count = parseQuestions(form.questions).length;
            return (
              <li key={form.id}>
                <Link
                  href={`/dashboard/forms/${form.id}`}
                  className="flex flex-col gap-0.5 rounded-card border border-border bg-surface p-4 transition-colors hover:bg-background"
                >
                  <span className="truncate font-semibold">{form.name}</span>
                  {/* .numeric on the line would turn the whole row LTR and drag
                      it away from the right edge. Only the digits are isolated. */}
                  <span className="text-sm text-muted">
                    <span className="numeric">{count}</span> שאלות
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

`src/app/dashboard/forms/new/page.tsx`:

```tsx
import type { Metadata } from "next";

import { FormBuilder } from "../form-builder";

export const metadata: Metadata = {
  title: "שאלון חדש | תמחורולוג",
};

export default function NewFormPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">שאלון חדש</h1>
      <FormBuilder />
    </div>
  );
}
```

`src/app/dashboard/forms/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireBusiness } from "@/lib/auth";
import { parseQuestions } from "@/lib/intake";

import { DeleteFormButton } from "../delete-form-button";
import { FormBuilder } from "../form-builder";

export const metadata: Metadata = {
  title: "עריכת שאלון | תמחורולוג",
};

export default async function EditFormPage({
  params,
}: PageProps<"/dashboard/forms/[id]">) {
  const { id } = await params;
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">עריכת שאלון</h1>
      <FormBuilder
        draft={{
          id: data.id,
          name: data.name,
          questions: parseQuestions(data.questions),
        }}
      />
      <DeleteFormButton id={data.id} name={data.name} />
    </div>
  );
}
```

- [ ] **Step 5: Add the nav tab**

In `src/app/dashboard/nav.tsx`, the `TABS` array only. Nothing else in that file changes.

```ts
const TABS = [
  { href: "/dashboard", label: "הצעות" },
  { href: "/dashboard/clients", label: "לקוחות" },
  { href: "/dashboard/forms", label: "שאלונים" },
  { href: "/dashboard/stats", label: "סיכום" },
  { href: "/dashboard/settings", label: "הגדרות" },
] as const;
```

The file's comment says "four links". Update that number to five in the same edit — a comment that contradicts the code beside it is worse than no comment.

- [ ] **Step 6: Write the browser test**

`scripts/verify-forms.mjs`. Follow `scripts/verify-client-hub.mjs` for the sign-in helper and the `nextjs-portal` suppression.

```js
/**
 * Checks the questionnaire library and builder.
 *
 * Run:  npm run verify:forms   (against a production build on :3100)
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const email = `forms-${Date.now()}@example.com`;
const PASSWORD = "forms-check-password-123";
const FORM_NAME = "שאלון בדיקה";
let userId = null;

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();

  /* ---------------------------------------------------------- sign up */
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת שאלונים");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  /* ------------------------------------------------------ reachable */
  check(
    "there is a nav link to the library",
    (await page.locator('a[href="/dashboard/forms"]').count()) >= 1,
  );

  await page.goto(`${BASE}/dashboard/forms`, { waitUntil: "networkidle" });
  check(
    "an owner with no forms is told so",
    (await page.locator("body").innerText()).includes("עדיין לא יצרת שאלון"),
  );

  /* -------------------------------------------------- empty rejected */
  await page.goto(`${BASE}/dashboard/forms/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForSelector('[role="alert"]', { timeout: 10000 });
  check("a form with no name is rejected", page.url().includes("/forms/new"));

  await page.fill('input[name="name"]', FORM_NAME);
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForTimeout(1500);
  check(
    "a form with no questions is rejected",
    page.url().includes("/forms/new") &&
      (await page.locator('[role="alert"]').innerText()).includes("שאלה אחת"),
  );

  /* ------------------------------------------------------- build one */
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "+ הוספת שאלה" }).click();
  await page.getByLabel("שאלה 1").fill("מה גודל החדר?");
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForURL("**/dashboard/forms", { timeout: 20000 });
  check("saving a valid form returns to the library", true);

  const { data: saved } = await admin
    .from("intake_forms")
    .select("id, name, questions")
    .eq("business_id", biz.id)
    .single();

  check("the form is in the database", Boolean(saved), saved?.name ?? "null");
  check("it kept its name", saved?.name === FORM_NAME);
  check("it has two questions", saved?.questions?.length === 2, String(saved?.questions?.length));
  check(
    "the bank question kept its key as its id and its options",
    saved?.questions?.[0]?.id === "floor_elevator" &&
      saved?.questions?.[0]?.options?.length === 5,
  );
  check(
    "the free-text question is a text question",
    saved?.questions?.[1]?.kind === "text" &&
      saved?.questions?.[1]?.prompt === "מה גודל החדר?",
  );

  /* -------------------------------------------------------- it round-trips */
  await page.goto(`${BASE}/dashboard/forms/${saved.id}`, { waitUntil: "networkidle" });
  check(
    "reopening it shows the saved name",
    (await page.locator('input[name="name"]').inputValue()) === FORM_NAME,
  );
  check(
    "reopening it shows the saved free text",
    (await page.getByLabel("שאלה 1").inputValue()) === "מה גודל החדר?",
  );
  check(
    "reopening it shows the bank question ticked",
    await page.locator('input[type="checkbox"]').first().isChecked(),
  );

  await browser.close();
}

try {
  console.log(`\nForm library against ${BASE}\n`);
  await run();
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
```

Add to `package.json`:

```json
"verify:forms": "node --env-file=.env.local scripts/verify-forms.mjs",
```

- [ ] **Step 7: Build and run everything**

```bash
npm run lint
npm run typecheck
npm run build
npx next start -p 3100
```

Then, in a second shell: `npm run verify:forms`
Expected: all checks pass.

Then the full existing suite:

```bash
npm run verify:csp && npm run verify:redirect && npm run verify:quote && npm run verify:seo && npm run verify:a11y && npm run verify:auth && npm run verify:settings && npm run verify:bidi && npm run verify:contact && npm run verify:client-hub && npm run verify:landing
```

Expected: every script exits 0. **Do not pipe these into `tail`** — the pipe's exit code hides a failure.

- [ ] **Step 8: Look at it**

Screenshot `/dashboard/forms` and `/dashboard/forms/new` at 390px and 1440px. Confirm: the nav has five tabs and none of them wrap; no `.numeric` class sits on a block element that also holds Hebrew; the builder's remove button is at least 44px tall.

- [ ] **Step 9: Commit and push**

```bash
git add src/app/dashboard/forms src/app/dashboard/nav.tsx scripts/verify-forms.mjs package.json
git commit -m "Intake forms: library and builder"
git push
```

**STOP. Slice 1 is complete. Report to the user and wait for approval.**

---

## Task 4: Sending a questionnaire

**Files:**
- Create: `supabase/migrations/0014_intake_submit.sql`
- Create: `src/app/dashboard/clients/[id]/intake-actions.ts`
- Create: `src/app/dashboard/clients/[id]/send-intake.tsx`
- Modify: `src/lib/whatsapp.ts` (append one function)
- Modify: `src/app/dashboard/clients/[id]/page.tsx` (render the component)

**Interfaces:**
- Consumes: `buildWhatsAppUrl` from `@/lib/whatsapp`; `SITE_URL` from `@/lib/site`.
- Produces:
  - `buildIntakeMessage({ businessName, clientName, formUrl }): string`
  - `createIntakeRequestAction(previous: IntakeSendState, formData: FormData): Promise<IntakeSendState>` where `IntakeSendState = { error: string | null; token: string | null }`
  - `<SendIntake clientId clientName clientPhone businessName siteUrl forms />` — `forms` is `{ id: string; name: string }[]`
  - SQL function `public.submit_intake_request(p_token text, p_answers jsonb) returns text` — `'ok'`, `'unchanged'`.

- [ ] **Step 1: Write the submit function migration**

```sql
/*
  Recording a client's answers.

  One security definer function, keyed on the public token, called only from the
  server. Two things are enforced in SQL rather than in application code:

  1. submitted_at is null in the WHERE clause, so a double tap, a refresh, or a
     replayed request cannot overwrite answers that are already in. Checking
     this in TypeScript would leave a race between the read and the write.

  2. Nothing is returned but a status word. The function is reachable only
     through the server, but it still tells the caller nothing about a token it
     did not already hold.

  The answers themselves are validated in TypeScript against the questions
  snapshotted on the row, because the rules are about Hebrew text and option
  lists, not about integrity.

  Block comments only, so no editor can autocorrect a double dash.
*/

create or replace function public.submit_intake_request(
  p_token   text,
  p_answers jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.intake_requests
  set answers = p_answers,
      submitted_at = now()
  where public_token = p_token
    and submitted_at is null
  returning id into v_id;

  if v_id is null then
    /* Either the token is wrong, or this was already answered. */
    return 'unchanged';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.submit_intake_request(text, jsonb) from public;
revoke all on function public.submit_intake_request(text, jsonb) from anon;
revoke all on function public.submit_intake_request(text, jsonb) from authenticated;
```

- [ ] **Step 2: ASCII check, hand to the user, wait**

Same command as Task 1 Step 2 with the new filename. Then print it and wait for the user to confirm they ran it.

- [ ] **Step 3: Add the message builder**

Append to `src/lib/whatsapp.ts`, below `buildReminderMessage`. Do not modify anything already in the file.

```ts
export function buildIntakeMessage({
  businessName,
  clientName,
  formUrl,
}: {
  businessName: string;
  clientName: string;
  formUrl: string;
}): string {
  const greeting = clientName ? `היי ${firstName(clientName)},` : "היי,";

  return [
    `${greeting} כאן ${businessName}.`,
    "",
    "כדי שאוכל להכין לך הצעת מחיר מדויקת, אשמח אם תענה על כמה שאלות קצרות:",
    formUrl,
    "",
    "זה לוקח פחות מדקה.",
  ].join("\n");
}
```

- [ ] **Step 4: Write the send action**

`src/app/dashboard/clients/[id]/intake-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { requireBusiness } from "@/lib/auth";
import { parseQuestions, validateQuestions } from "@/lib/intake";

export type IntakeSendState = {
  error: string | null;
  /** The token of the request just created, used to build the WhatsApp link. */
  token: string | null;
};

export const EMPTY_INTAKE_SEND_STATE: IntakeSendState = {
  error: null,
  token: null,
};

/**
 * Creates one sent copy of a saved questionnaire.
 *
 * The questions and the form name are COPIED onto the request here. From this
 * point the saved form can be edited or deleted without touching the link now
 * in the client's hands, and the answers stay attached to what was actually
 * asked.
 */
export async function createIntakeRequestAction(
  _previousState: IntakeSendState,
  formData: FormData,
): Promise<IntakeSendState> {
  const { supabase, business } = await requireBusiness();

  const clientId = String(formData.get("clientId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  if (!clientId || !formId) {
    return { error: "יש לבחור שאלון.", token: null };
  }

  const { data: form } = await supabase
    .from("intake_forms")
    .select("id, name, questions")
    .eq("id", formId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!form) return { error: "השאלון לא נמצא.", token: null };

  const questions = parseQuestions(form.questions);
  const problem = validateQuestions(questions);
  if (problem) {
    return { error: "השאלון אינו תקין. פתח אותו ותקן לפני השליחה.", token: null };
  }

  // The client is re-read under RLS rather than trusted from the URL: this
  // action is reachable by POST like any other.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!client) return { error: "הלקוח לא נמצא.", token: null };

  const { data: created, error } = await supabase
    .from("intake_requests")
    .insert({
      business_id: business.id,
      form_id: form.id,
      client_id: client.id,
      form_name: form.name,
      questions,
    })
    .select("public_token")
    .single();

  if (error || !created) {
    return { error: "יצירת הקישור נכשלה. נסה שוב.", token: null };
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { error: null, token: created.public_token };
}
```

- [ ] **Step 5: Write the send component**

`src/app/dashboard/clients/[id]/send-intake.tsx`. The two taps are the point — read the comment before changing it.

```tsx
"use client";

import { useActionState, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClasses } from "@/components/ui/text-field";
import { buildIntakeMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  createIntakeRequestAction,
  EMPTY_INTAKE_SEND_STATE,
} from "./intake-actions";

export function SendIntake({
  clientId,
  clientName,
  clientPhone,
  businessName,
  siteUrl,
  forms,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  businessName: string;
  siteUrl: string;
  forms: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    createIntakeRequestAction,
    EMPTY_INTAKE_SEND_STATE,
  );
  const [formId, setFormId] = useState(forms.length === 1 ? forms[0].id : "");
  const selectId = useId();

  /*
   * Two taps, not one, and this is deliberate.
   *
   * A browser blocks a window opened after an await, which is why every
   * WhatsApp hand-off in this app is a real <a> the user clicks directly. The
   * token cannot exist before the row does, so a single tap would have to
   * either open the window after the server call — the blocked case — or
   * pre-create a request for every saved form on page load, littering the
   * table with rows nobody sent.
   *
   * A GET link that creates the row and redirects is worse: next/link
   * prefetches, so merely hovering the list would create rows.
   */
  const link = state.token
    ? buildWhatsAppUrl(
        clientPhone,
        buildIntakeMessage({
          businessName,
          clientName,
          formUrl: `${siteUrl}/f/${state.token}`,
        }),
      )
    : null;

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted">
        עדיין לא יצרת שאלון. אפשר ליצור אחד במסך השאלונים.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            איזה שאלון לשלוח?
          </label>
          <select
            id={selectId}
            name="formId"
            value={formId}
            onChange={(event) => setFormId(event.target.value)}
            className={inputClasses}
            required
          >
            <option value="">בחר שאלון…</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton pendingLabel="מכין קישור…" variant="secondary">
          הכנת קישור
        </SubmitButton>
      </form>

      {state.error ? <Alert>{state.error}</Alert> : null}

      {link ? (
        <div className="flex flex-col gap-2 rounded-tile bg-background p-3">
          <p className="text-sm">
            הקישור מוכן.
            {link.hasRecipient
              ? ""
              : " ללקוח אין טלפון שמור, אז וואטסאפ ישאל למי לשלוח."}
          </p>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "primary" })}
          >
            שליחה בוואטסאפ
          </a>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Render it on the client hub**

In `src/app/dashboard/clients/[id]/page.tsx`, add the query and the section. **Add only.** Do not restructure what is there.

Add to the imports:

```tsx
import { SITE_URL } from "@/lib/site";

import { SendIntake } from "./send-intake";
```

After the `quotes` query, add:

```tsx
const { data: formRows } = await supabase
  .from("intake_forms")
  .select("id, name")
  .eq("business_id", business.id)
  .order("created_at", { ascending: false });
```

And immediately before the `<details>` that holds the edit form, add:

```tsx
{/* Collapsed by default for the same reason the edit form is: most visits to
    this page are to read a quote, not to send a questionnaire. */}
<details className="rounded-card border border-border bg-surface">
  <summary className="cursor-pointer px-5 py-4 font-semibold">
    שליחת שאלון
  </summary>
  <div className="border-t border-border p-5">
    <SendIntake
      clientId={client.id}
      clientName={client.full_name}
      clientPhone={client.phone}
      businessName={business.name}
      siteUrl={SITE_URL}
      forms={formRows ?? []}
    />
  </div>
</details>
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_intake_submit.sql src/lib/whatsapp.ts src/app/dashboard/clients/\[id\]
git commit -m "Intake forms: sending a questionnaire"
```

---

## Task 5: The client's page

**Files:**
- Create: `src/lib/public-intake.ts`
- Create: `src/app/f/[public_token]/page.tsx`
- Create: `src/app/f/[public_token]/intake-form.tsx`
- Create: `src/app/f/[public_token]/actions.ts`
- Modify: `src/proxy.ts` (one condition)
- Modify: `src/app/robots.ts` (one array entry)
- Modify: `next.config.ts` (one headers entry)
- Create: `scripts/verify-intake.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createSupabaseAdminClient` from `@/lib/supabase/admin`; `parseQuestions`, `parseAnswers`, `validateAnswers` from `@/lib/intake`.
- Produces:
  - `PublicIntake = { id: string; formName: string; businessName: string; questions: IntakeQuestion[]; submittedAt: string | null }`
  - `loadPublicIntake(token: string): Promise<PublicIntake | null>`
  - `submitIntake(token: string, answers: IntakeAnswers): Promise<"ok" | "unchanged" | "error">`
  - `submitIntakeAction(previous: IntakeState, formData: FormData): Promise<IntakeState>` where `IntakeState = { error: string | null; done: boolean }`

- [ ] **Step 1: Write the loader**

`src/lib/public-intake.ts`. This is the mirror of `src/lib/public-quote.ts` — read that file first and match it.

```ts
import "server-only";

import {
  parseQuestions,
  type IntakeAnswers,
  type IntakeQuestion,
} from "@/lib/intake";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*
 * Loading a questionnaire for the public page.
 *
 * The same shape as loadPublicQuote, for the same reasons: the service_role key
 * does exactly one thing here, an exact-match lookup on public_token. There is
 * no listing, no prefix match, no client-controlled filter, and every field
 * returned is chosen explicitly, so nothing about the owner or the client leaks
 * beyond what belongs on the page.
 *
 * The client's own name is deliberately NOT returned. The person holding the
 * link knows who they are, and a leaked link should confirm nothing about who
 * it was sent to.
 */

/** Tokens are 32 lowercase hex chars. Anything else never reaches the database. */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export type PublicIntake = {
  id: string;
  formName: string;
  businessName: string;
  questions: IntakeQuestion[];
  submittedAt: string | null;
};

export async function loadPublicIntake(
  token: string,
): Promise<PublicIntake | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const supabase = createSupabaseAdminClient();

  const { data: request } = await supabase
    .from("intake_requests")
    .select("id, business_id, form_name, questions, submitted_at")
    .eq("public_token", token)
    .maybeSingle();

  if (!request) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", request.business_id)
    .maybeSingle();

  return {
    id: request.id,
    formName: request.form_name,
    businessName: business?.name ?? "",
    questions: parseQuestions(request.questions),
    submittedAt: request.submitted_at,
  };
}

/**
 * Records the answers through a security definer function, so "already
 * answered" is decided by the same statement that writes.
 */
export async function submitIntake(
  token: string,
  answers: IntakeAnswers,
): Promise<"ok" | "unchanged" | "error"> {
  if (!TOKEN_PATTERN.test(token)) return "error";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("submit_intake_request", {
    p_token: token,
    p_answers: answers,
  });

  if (error) return "error";
  return data === "ok" ? "ok" : "unchanged";
}
```

- [ ] **Step 2: Write the submit action**

`src/app/f/[public_token]/actions.ts`. Modelled on `src/app/q/[public_token]/actions.ts`.

```ts
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
```

- [ ] **Step 3: Write the answer form**

`src/app/f/[public_token]/intake-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { MAX_ANSWER_LENGTH, type IntakeQuestion } from "@/lib/intake";

import { EMPTY_INTAKE_STATE, submitIntakeAction } from "./actions";

export function IntakeForm({
  token,
  questions,
}: {
  token: string;
  questions: IntakeQuestion[];
}) {
  const [state, formAction] = useActionState(
    submitIntakeAction,
    EMPTY_INTAKE_STATE,
  );

  if (state.done) {
    return (
      <div className="rounded-card border border-success/30 bg-success-soft p-6 text-center">
        <p className="text-lg font-bold text-success">תודה!</p>
        <p className="mt-1 text-sm text-success">
          התשובות נשלחו. נחזור אליך עם הצעת מחיר.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {questions.map((question, index) => (
        <fieldset
          key={question.id}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
        >
          <legend className="px-1 text-base font-semibold">
            <span className="numeric">{index + 1}</span>. {question.prompt}
          </legend>

          {question.kind === "choice" ? (
            <div className="flex flex-col gap-2">
              {question.options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-control border border-border px-4 py-3 text-base has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    className="h-5 w-5 shrink-0 accent-[color:var(--brand)]"
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              name={question.id}
              rows={3}
              maxLength={MAX_ANSWER_LENGTH}
              aria-label={question.prompt}
              className="w-full rounded-control border border-border bg-surface px-3 py-2.5 text-base leading-relaxed focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand"
            />
          )}
        </fieldset>
      ))}

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton pendingLabel="שולח…">שליחת התשובות</SubmitButton>
    </form>
  );
}
```

- [ ] **Step 4: Write the page**

`src/app/f/[public_token]/page.tsx`. The `robots` line is the most important one in the file.

```tsx
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
        <p className="mt-2 text-sm text-muted">
          התשובות עוזרות להכין לך הצעת מחיר מדויקת. זה לוקח פחות מדקה.
        </p>
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
```

- [ ] **Step 5: The three additive protections**

`src/proxy.ts` — one condition. Extend the existing early return and its comment; do not add a second branch:

```ts
  if (
    pathname.startsWith("/q/") ||
    pathname.startsWith("/f/") ||
    SESSIONLESS_PATHS.has(pathname)
  ) {
```

Add to that comment block:

```
   * /f, the intake questionnaire, is here for exactly the same reasons: the
   * client has no account, the page is fetched server side by exact token, and
   * the submit action validates the token itself.
```

`src/app/robots.ts` — one entry:

```ts
      disallow: ["/q/", "/f/", "/dashboard/", "/login", "/signup"],
```

`next.config.ts` — extend the existing `/q` rule rather than duplicating it:

```ts
      /*
       * The quote link and the questionnaire link are both bearer tokens in a
       * URL. strict-origin-when-cross-origin would still send the full path to
       * a same-origin destination, and no outbound navigation from either page
       * may carry the token in a Referer header.
       */
      {
        source: "/q/:public_token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/f/:public_token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
```

- [ ] **Step 6: Write the verification**

`scripts/verify-intake.mjs`. The anonymous half runs in a **fresh browser context with no cookies**, which is what proves the page does not depend on a session.

```js
/**
 * Sends a questionnaire, answers it as an anonymous client, and checks that
 * the answers land keyed by question id and cannot be overwritten.
 *
 * Run:  npm run verify:intake   (against a production build on :3100)
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const email = `intake-${Date.now()}@example.com`;
const PASSWORD = "intake-check-password-123";
let userId = null;

async function run() {
  const browser = await chromium.launch();
  const hidePortal = () =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    });

  const owner = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await owner.addInitScript(hidePortal);
  const page = await owner.newPage();

  /* ------------------------------------------------- owner: set the stage */
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת שאלון");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה לוי", phone: "+972541234567" })
    .select("id")
    .single();

  const { data: form } = await admin
    .from("intake_forms")
    .insert({
      business_id: biz.id,
      name: "שאלון בדיקה",
      questions: [
        {
          id: "floor_elevator",
          kind: "choice",
          prompt: "האם מדובר בבניין ללא מעלית, ואם כן באיזו קומה?",
          options: ["לא", "1", "2", "3", "4"],
        },
        { id: "text-1", kind: "text", prompt: "מה גודל החדר?" },
      ],
    })
    .select("id")
    .single();

  /* ---------------------------------------------------- owner: send it */
  await page.goto(`${BASE}/dashboard/clients/${client.id}`, { waitUntil: "networkidle" });
  await page.getByText("שליחת שאלון").click();
  await page.selectOption('select[name="formId"]', form.id);
  await page.getByRole("button", { name: "הכנת קישור" }).click();
  await page.waitForSelector('a:has-text("שליחה בוואטסאפ")', { timeout: 20000 });

  const { data: request } = await admin
    .from("intake_requests")
    .select("id, public_token, questions, form_name, answers, submitted_at")
    .eq("client_id", client.id)
    .single();

  check("a request row was created", Boolean(request));
  check(
    "the token is 32 lowercase hex characters",
    /^[0-9a-f]{32}$/.test(request?.public_token ?? ""),
    request?.public_token ?? "null",
  );
  check(
    "the questions were snapshotted onto the request",
    request?.questions?.length === 2,
    String(request?.questions?.length),
  );
  check("the form name was snapshotted", request?.form_name === "שאלון בדיקה");
  check("nothing is answered yet", request?.answers === null);

  const waHref = await page.locator('a:has-text("שליחה בוואטסאפ")').getAttribute("href");
  check(
    "the WhatsApp link carries the token and the right recipient",
    waHref.includes(request.public_token) && waHref.startsWith("https://wa.me/972541234567"),
  );

  /* --------------------------------------- editing the form does not leak */
  await admin.from("intake_forms").update({ name: "שם אחר", questions: [] }).eq("id", form.id);
  const { data: afterEdit } = await admin
    .from("intake_requests")
    .select("form_name, questions")
    .eq("id", request.id)
    .single();
  check(
    "editing the saved form does not change a link already sent",
    afterEdit.form_name === "שאלון בדיקה" && afterEdit.questions.length === 2,
  );

  /* ------------------------------------------------ the anonymous client */
  const anon = await browser.newContext({ viewport: { width: 390, height: 850 } });
  await anon.addInitScript(hidePortal);
  const client_page = await anon.newPage();
  const url = `${BASE}/f/${request.public_token}`;
  await client_page.goto(url, { waitUntil: "networkidle" });

  check(
    "an anonymous visitor sees the questions",
    (await client_page.locator("fieldset").count()) === 2,
  );
  check(
    "the page is noindex",
    /noindex/.test(await client_page.content()),
  );
  check(
    "the client's name is not on the page",
    !(await client_page.locator("body").innerText()).includes("דנה"),
  );

  const headRes = await fetch(url, { redirect: "manual" });
  check(
    "the token is not leaked in a Referer",
    headRes.headers.get("referrer-policy") === "no-referrer",
    headRes.headers.get("referrer-policy") ?? "missing",
  );
  check(
    "there is a CSP on it",
    Boolean(headRes.headers.get("content-security-policy")),
  );

  const robotsText = await (await fetch(`${BASE}/robots.txt`)).text();
  check("robots.txt disallows /f/", robotsText.includes("Disallow: /f/"));

  /* ---------------------------------------------------------- answer it */
  await client_page.getByRole("radio", { name: "2", exact: true }).check();
  await client_page.locator('textarea[name="text-1"]').fill("שלושה על ארבעה מטר");
  await client_page.getByRole("button", { name: "שליחת התשובות" }).click();
  await client_page.waitForSelector("text=תודה", { timeout: 20000 });

  const { data: answered } = await admin
    .from("intake_requests")
    .select("answers, submitted_at")
    .eq("id", request.id)
    .single();

  check("the answers landed", answered.answers !== null);
  check(
    "they are keyed by question id",
    answered.answers?.floor_elevator === "2" &&
      answered.answers?.["text-1"] === "שלושה על ארבעה מטר",
    JSON.stringify(answered.answers),
  );
  check("submitted_at was set", Boolean(answered.submitted_at));

  /* ----------------------------------------------- a second one is refused */
  await client_page.goto(url, { waitUntil: "networkidle" });
  check(
    "a second visit shows the answered state, not an empty form",
    (await client_page.locator("fieldset").count()) === 0 &&
      (await client_page.locator("body").innerText()).includes("כבר ענית"),
  );

  const { data: replay } = await admin.rpc("submit_intake_request", {
    p_token: request.public_token,
    p_answers: { floor_elevator: "4", "text-1": "overwritten" },
  });
  check("a replayed submission is refused by the database", replay === "unchanged", String(replay));

  const { data: intact } = await admin
    .from("intake_requests")
    .select("answers")
    .eq("id", request.id)
    .single();
  check(
    "the original answers were not overwritten",
    intact.answers?.floor_elevator === "2",
  );

  /* ------------------------------------------------------ an unknown token */
  const missing = await fetch(`${BASE}/f/${"a".repeat(32)}`, { redirect: "manual" });
  check("an unknown token is a 404", missing.status === 404, String(missing.status));
  const malformed = await fetch(`${BASE}/f/not-a-token`, { redirect: "manual" });
  check("a malformed token is a 404", malformed.status === 404, String(malformed.status));

  await browser.close();
}

try {
  console.log(`\nIntake questionnaire against ${BASE}\n`);
  await run();
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
```

Add to `package.json`:

```json
"verify:intake": "node --env-file=.env.local scripts/verify-intake.mjs",
```

- [ ] **Step 7: Run everything**

```bash
npm run lint
npm run typecheck
npm run build
```

Start the production server on 3100, then:

```bash
npm run verify:intake && npm run verify:forms && npm run verify:intake-unit
```

Then the full existing suite as listed in Task 3 Step 7. `verify:csp` and `verify:seo` matter most here — the proxy and robots both changed.

- [ ] **Step 8: Look at it**

Screenshot `/f/<token>` at 390px. Confirm: the radio labels are at least 44px tall, the numbers on the legends did not drag the Hebrew to the left, and nothing overflows horizontally.

- [ ] **Step 9: Commit and push**

```bash
git add src/app/f src/lib/public-intake.ts src/proxy.ts src/app/robots.ts next.config.ts scripts/verify-intake.mjs package.json
git commit -m "Intake forms: the client's page"
git push
```

**STOP. Slice 2 is complete. Report to the user and wait for approval.**

---

## Task 6: The answers on the client hub

**Files:**
- Create: `src/app/dashboard/clients/[id]/intake-answers.tsx`
- Modify: `src/app/dashboard/clients/[id]/page.tsx`
- Modify: `scripts/verify-client-hub.mjs` (add checks; change nothing existing)

**Interfaces:**
- Consumes: `parseQuestions`, `parseAnswers` from `@/lib/intake`; `formatDate` from `@/lib/format`.
- Produces: `<IntakeAnswersCard request={IntakeRequestRow} />` and `type IntakeRequestRow`. Named `...Card`, not `IntakeAnswers`, because `@/lib/intake` already exports a type by that name and a file importing both would have to alias one of them.

- [ ] **Step 1: Write the card**

`src/app/dashboard/clients/[id]/intake-answers.tsx`. A server component: it renders text and needs no interactivity.

```tsx
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
 * Nothing here is calculated from. This is what the owner reads while deciding
 * a price by hand, which is the whole point of the feature.
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
```

- [ ] **Step 2: Render the section**

In `src/app/dashboard/clients/[id]/page.tsx`, add the query beside the others:

```tsx
const { data: intakeRows } = await supabase
  .from("intake_requests")
  .select("id, form_name, questions, answers, sent_at, submitted_at")
  .eq("client_id", client.id)
  .eq("business_id", business.id)
  .order("sent_at", { ascending: false });

const intakeRequests = (intakeRows ?? []) as IntakeRequestRow[];
```

And add the section immediately after the quotes `</section>`, before the "שליחת שאלון" details:

```tsx
{/* Only when something was sent. An empty-state box for a feature this owner
    may never use would be noise on the page they open most. */}
{intakeRequests.length > 0 ? (
  <section className="flex flex-col gap-3">
    <h2 className="text-lg font-semibold">שאלונים</h2>
    <div className="grid gap-2 lg:grid-cols-2">
      {intakeRequests.map((request) => (
        <IntakeAnswersCard key={request.id} request={request} />
      ))}
    </div>
  </section>
) : null}
```

With the import:

```tsx
import { IntakeAnswersCard, type IntakeRequestRow } from "./intake-answers";
```

- [ ] **Step 3: Extend the hub verification**

Append to `scripts/verify-client-hub.mjs`, inside `run()`, before `browser.close()`. Change nothing that is already in that file.

```js
  /* ------------------------------------------------ intake answers show up */
  const { data: intakeForm } = await admin
    .from("intake_forms")
    .insert({
      business_id: businessId,
      name: "שאלון בדיקה",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
    })
    .select("id")
    .single();

  await admin.from("intake_requests").insert([
    {
      business_id: businessId,
      form_id: intakeForm.id,
      client_id: clientId,
      form_name: "שאלון בדיקה",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
      answers: { "text-1": "שלושה על ארבעה" },
      submitted_at: new Date().toISOString(),
    },
    {
      business_id: businessId,
      form_id: intakeForm.id,
      client_id: clientId,
      form_name: "שאלון שני",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
    },
  ]);

  await page.goto(`${BASE}/dashboard/clients/${clientId}`, { waitUntil: "networkidle" });
  const hubText = await page.locator("body").innerText();
  check("an answered questionnaire shows its question", hubText.includes("מה גודל החדר?"));
  check("and its answer", hubText.includes("שלושה על ארבעה"));
  check("an unanswered one says so", hubText.includes("טרם נענה"));
```

Note: `businessId` and `clientId` must already be in scope there. If the existing script names them differently, use its names — do not rename anything in it.

- [ ] **Step 4: Run it**

```bash
npm run lint
npm run typecheck
npm run build
```

Start the server on 3100, then `npm run verify:client-hub`, then the full suite.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/dashboard/clients/\[id\] scripts/verify-client-hub.mjs
git commit -m "Intake forms: answers on the client card"
git push
```

**STOP. Slice 3 is complete. Report to the user and wait for approval.**

---

## Task 7: Notifications

**Files:**
- Create: `supabase/migrations/0015_notifications.sql`
- Create: `src/lib/notifications.ts`
- Create: `src/app/dashboard/notification-bell.tsx`
- Create: `src/app/dashboard/notifications/page.tsx`
- Modify: `src/app/dashboard/layout.tsx` (one element in the header)
- Create: `scripts/verify-notifications.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `requireBusiness` from `@/lib/auth`.
- Produces:
  - `type Notification = { id: string; kind: "intake_submitted" | "quote_approved"; subject_name: string | null; quote_number: number | null; intake_request_id: string | null; quote_id: string | null; read_at: string | null; created_at: string }`
  - `notificationText(n: Notification): string`
  - `notificationHref(n: Notification): string`
  - `loadNotifications()`, `unreadNotificationCount()`, `markAllNotificationsRead()`
  - SQL: table `public.notifications`; `submit_intake_request` replaced.

- [ ] **Step 1: Write the migration**

```sql
/*
  In-app notifications.

  There is no email infrastructure in this project. Adding a provider would mean
  a dependency, an API key, a domain to verify and a running cost, so these are
  in-app only and the owner sees them when they open the app. That is a real
  limitation, stated rather than hidden.

  What is stored is deliberately NOT a sentence. These rows are written by SQL
  functions, and every migration here is pure ASCII, so a Hebrew literal cannot
  appear in one. Instead the two facts that could disappear later are
  snapshotted -- the client's name and the quote number -- and the wording is
  composed in TypeScript at render time. Same immunity to a client deleted next
  month; the copy stays where it can be changed without a migration.

  Block comments only, so no editor can autocorrect a double dash.
*/

create table if not exists public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  kind               text not null
                     check (kind in ('intake_submitted', 'quote_approved')),
  subject_name       text,
  quote_number       integer,
  intake_request_id  uuid references public.intake_requests (id) on delete set null,
  quote_id           uuid references public.quotes (id) on delete set null,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists notifications_business_id_idx
  on public.notifications (business_id, created_at desc);

/*
  The unread count runs on every dashboard page load, so it gets its own
  partial index rather than filtering the full history each time.
*/
create index if not exists notifications_unread_idx
  on public.notifications (business_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = notifications.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/*
  Update is allowed only so the owner can mark their own as read. There is no
  insert policy: every row is written by a security definer function, because
  the events that produce one are caused by a client who has no account.
*/
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = notifications.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = notifications.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ============ raise one when a questionnaire comes back ============ */

/*
  Replaces the function from 0014 rather than editing that file, the same way
  0012 replaced record_quote_view. The submission and the notification are one
  statement apart inside one function, so there is no state where the answers
  are in and the owner was never told.
*/

create or replace function public.submit_intake_request(
  p_token   text,
  p_answers jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_business uuid;
  v_client   uuid;
  v_name     text;
begin
  update public.intake_requests
  set answers = p_answers,
      submitted_at = now()
  where public_token = p_token
    and submitted_at is null
  returning id, business_id, client_id into v_id, v_business, v_client;

  if v_id is null then
    /* Either the token is wrong, or this was already answered. */
    return 'unchanged';
  end if;

  select full_name into v_name from public.clients where id = v_client;

  insert into public.notifications
    (business_id, kind, subject_name, intake_request_id)
  values
    (v_business, 'intake_submitted', v_name, v_id);

  return 'ok';
end;
$$;

revoke all on function public.submit_intake_request(text, jsonb) from public;
revoke all on function public.submit_intake_request(text, jsonb) from anon;
revoke all on function public.submit_intake_request(text, jsonb) from authenticated;
```

- [ ] **Step 2: ASCII check, hand to the user, wait for confirmation**

Same as Task 1 Step 2. Note the comment above uses `--` inside prose; **rewrite it** so no double dash appears anywhere — replace "later -- the client's name and the quote number -- and" with "later (the client's name and the quote number) and". Re-run the check until it prints `no double dash`.

- [ ] **Step 3: Write the module**

`src/lib/notifications.ts`:

```ts
import "server-only";

import { requireBusiness } from "@/lib/auth";

export type NotificationKind = "intake_submitted" | "quote_approved";

export type Notification = {
  id: string;
  kind: NotificationKind;
  subject_name: string | null;
  quote_number: number | null;
  intake_request_id: string | null;
  quote_id: string | null;
  read_at: string | null;
  created_at: string;
};

const COLUMNS =
  "id, kind, subject_name, quote_number, intake_request_id, quote_id, read_at, created_at";

/**
 * The Hebrew sentence, composed here rather than stored.
 *
 * The row snapshots the name and the number, so a client deleted next month
 * does not blank last month's notification, but the wording lives in the
 * codebase where changing it costs nothing.
 */
export function notificationText(notification: Notification): string {
  const who = notification.subject_name?.trim() || "לקוח";

  if (notification.kind === "quote_approved") {
    const number = notification.quote_number;
    return number === null
      ? `${who} אישר את ההצעה`
      : `${who} אישר את הצעה מספר ${number}`;
  }

  return `${who} מילא את השאלון`;
}

/** Where tapping it goes. Falls back to the list when the target is gone. */
export function notificationHref(notification: Notification): string {
  if (notification.kind === "quote_approved" && notification.quote_id) {
    return `/dashboard/quotes/${notification.quote_id}`;
  }
  return "/dashboard/notifications";
}

export async function unreadNotificationCount(): Promise<number> {
  const { supabase, business } = await requireBusiness();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .is("read_at", null);

  return count ?? 0;
}

export async function loadNotifications(): Promise<Notification[]> {
  const { supabase, business } = await requireBusiness();

  const { data } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as Notification[];
}

/**
 * One update for everything currently unread.
 *
 * There is no per-item read control on purpose: the owner opened the list to
 * look at them, and a list that has to be dismissed one row at a time is a
 * chore rather than a feature.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { supabase, business } = await requireBusiness();

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("read_at", null);
}
```

- [ ] **Step 4: Write the bell**

`src/app/dashboard/notification-bell.tsx`. A server component — it reads a count and renders a link, so it needs no client JavaScript.

```tsx
import Link from "next/link";

import { unreadNotificationCount } from "@/lib/notifications";

export async function NotificationBell() {
  const unread = await unreadNotificationCount();

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={
        unread > 0 ? `התראות, ${unread} חדשות` : "התראות"
      }
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-background hover:text-foreground"
    >
      <span aria-hidden="true" className="text-xl">
        🔔
      </span>
      {unread > 0 ? (
        // aria-hidden because the count is already in the link's label; a
        // screen reader should hear it once, not twice.
        <span
          aria-hidden="true"
          className="numeric absolute top-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 5: Write the list**

`src/app/dashboard/notifications/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { formatDateTime } from "@/lib/format";
import {
  loadNotifications,
  markAllNotificationsRead,
  notificationHref,
  notificationText,
} from "@/lib/notifications";

export const metadata: Metadata = {
  title: "התראות | תמחורולוג",
};

export default async function NotificationsPage() {
  /*
   * Loaded before marking read, so this render still shows which ones were new.
   * The next visit sees them all as read, which is the correct answer: the
   * owner has now looked at them.
   */
  const notifications = await loadNotifications();
  await markAllNotificationsRead();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">התראות</h1>

      {notifications.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">
          אין התראות חדשות.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                href={notificationHref(notification)}
                className={
                  "flex flex-col gap-0.5 rounded-card border p-4 transition-colors hover:bg-background " +
                  (notification.read_at
                    ? "border-border bg-surface"
                    : "border-brand/30 bg-brand-soft")
                }
              >
                <span className="font-medium">
                  {notificationText(notification)}
                </span>
                {/* Digits isolated so the line stays right-aligned. */}
                <span className="text-xs text-muted">
                  <span className="numeric">
                    {formatDateTime(notification.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Put the bell in the header**

In `src/app/dashboard/layout.tsx`, one element, immediately before `<SignOutButton />`. Nothing else in the file changes:

```tsx
          <NotificationBell />
          <SignOutButton />
```

With the import:

```tsx
import { NotificationBell } from "./notification-bell";
```

The skip-link comment above says "four navigation links and a sign-out button, so a keyboard user tabs through six controls". That is now seven with the bell, and the nav gained a tab in slice 1. Update the number in the same edit.

- [ ] **Step 7: Write the verification**

`scripts/verify-notifications.mjs`:

```js
/**
 * Checks that a submitted questionnaire raises a notification, that it is
 * scoped to one business, and that opening the list marks it read.
 *
 * Run:  npm run verify:notifications   (against a production build on :3100)
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const stamp = Date.now();
const PASSWORD = "notif-check-password-123";
const emails = [`notif-a-${stamp}@example.com`, `notif-b-${stamp}@example.com`];
const userIds = [];

async function signUp(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת התראות");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  const userId = found.users.find((u) => u.email === email).id;
  userIds.push(userId);
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  return { page, businessId: biz.id };
}

async function run() {
  const browser = await chromium.launch();
  const a = await signUp(browser, emails[0]);
  const b = await signUp(browser, emails[1]);

  /* ------------------------------------------------ a submission raises one */
  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: a.businessId, full_name: "דנה לוי" })
    .select("id")
    .single();

  const questions = [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }];
  const { data: request } = await admin
    .from("intake_requests")
    .insert({
      business_id: a.businessId,
      client_id: client.id,
      form_name: "שאלון בדיקה",
      questions,
    })
    .select("id, public_token")
    .single();

  const anon = await browser.newContext({ viewport: { width: 390, height: 850 } });
  const clientPage = await anon.newPage();
  await clientPage.goto(`${BASE}/f/${request.public_token}`, { waitUntil: "networkidle" });
  await clientPage.locator('textarea[name="text-1"]').fill("שלושה מטר");
  await clientPage.getByRole("button", { name: "שליחת התשובות" }).click();
  await clientPage.waitForSelector("text=תודה", { timeout: 20000 });

  const { data: raised } = await admin
    .from("notifications")
    .select("id, kind, subject_name, intake_request_id, read_at")
    .eq("business_id", a.businessId);

  check("exactly one notification was raised", raised.length === 1, String(raised.length));
  check("it is the right kind", raised[0]?.kind === "intake_submitted");
  check("it snapshotted the client's name", raised[0]?.subject_name === "דנה לוי");
  check("it points at the request", raised[0]?.intake_request_id === request.id);
  check("it starts unread", raised[0]?.read_at === null);

  /* ------------------------------------------------------- another business */
  const { data: theirs } = await admin
    .from("notifications")
    .select("id")
    .eq("business_id", b.businessId);
  check("the other business has none", theirs.length === 0);

  await b.page.goto(`${BASE}/dashboard/notifications`, { waitUntil: "networkidle" });
  check(
    "and is told the list is empty",
    (await b.page.locator("body").innerText()).includes("אין התראות"),
  );

  /* --------------------------------------------------------------- the bell */
  await a.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const bell = a.page.locator('a[href="/dashboard/notifications"]');
  check("there is a bell in the header", (await bell.count()) >= 1);
  check(
    "it announces the unread count",
    (await bell.first().getAttribute("aria-label")).includes("1"),
  );

  /* ---------------------------------------------------- opening marks read */
  await a.page.goto(`${BASE}/dashboard/notifications`, { waitUntil: "networkidle" });
  check(
    "the list names the client",
    (await a.page.locator("body").innerText()).includes("דנה לוי"),
  );

  const { data: afterOpen } = await admin
    .from("notifications")
    .select("read_at")
    .eq("business_id", a.businessId);
  check("opening the list marked it read", afterOpen.every((n) => n.read_at !== null));

  await a.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check(
    "the bell no longer shows a count",
    (await a.page.locator('a[href="/dashboard/notifications"]').first().getAttribute("aria-label")) ===
      "התראות",
  );

  await browser.close();
}

try {
  console.log(`\nNotifications against ${BASE}\n`);
  await run();
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  process.exit(1);
}
```

Add to `package.json`:

```json
"verify:notifications": "node --env-file=.env.local scripts/verify-notifications.mjs",
```

- [ ] **Step 8: Run everything**

```bash
npm run lint
npm run typecheck
npm run build
```

Start the server on 3100, then `npm run verify:notifications`, then `npm run verify:intake` (the submit function changed underneath it), then the full existing suite. `verify:a11y` matters here — the header gained a control.

- [ ] **Step 9: Commit and push**

```bash
git add supabase/migrations/0015_notifications.sql src/lib/notifications.ts src/app/dashboard/notification-bell.tsx src/app/dashboard/notifications src/app/dashboard/layout.tsx scripts/verify-notifications.mjs package.json
git commit -m "Notifications: table, bell, list, and the intake trigger"
git push
```

**STOP. Slice 4 is complete. Report to the user and wait for approval.**

---

## Task 8: The quote-approved notification

This is the only task in the whole feature that changes code that already works. Read `supabase/migrations/0005_quote_decisions.sql` in full before writing anything.

**Files:**
- Create: `scripts/verify-quote-approval.mjs`
- Create: `supabase/migrations/0016_quote_approved_notification.sql`
- Modify: `package.json`

**Interfaces:**
- Consumes: `public.notifications` from Task 7; `public.record_quote_decision(text, text, text, text, text)` from `0005`.
- Produces: nothing new. The function keeps its exact signature and its exact return values (`'invalid'`, `'missing_name'`, `'unchanged'`, `'ok'`), because `src/app/q/[public_token]/actions.ts` branches on every one of them.

- [ ] **Step 1: Write the regression test FIRST, and run it against the unchanged function**

This is the point of the task ordering. The test must pass before the migration, so that a failure afterwards means the migration broke something.

`scripts/verify-quote-approval.mjs`:

```js
/**
 * The approval behaviour that already exists, asserted independently of the
 * notification being added on top of it.
 *
 * Run this BEFORE migration 0016 and confirm it passes. Then run it after.
 * A pass beforehand is what makes the second run meaningful.
 *
 * Run:  npm run verify:quote-approval
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const email = `approval-${Date.now()}@example.com`;
let userId = null;

async function run() {
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: "approval-check-password-123",
    email_confirm: true,
    user_metadata: { business_name: "בדיקת אישור" },
  });
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה לוי" })
    .select("id")
    .single();

  async function newQuote() {
    const { data: quote } = await admin
      .from("quotes")
      .insert({ business_id: biz.id, client_id: client.id, status: "sent" })
      .select("id, public_token, quote_number")
      .single();
    await admin.from("quote_line_items").insert({
      quote_id: quote.id,
      description: "עבודה",
      quantity: 1,
      unit_price: 100,
    });
    return quote;
  }

  /* ------------------------------------------------------------ approve */
  const q1 = await newQuote();
  const { data: outcome } = await admin.rpc("record_quote_decision", {
    p_token: q1.public_token,
    p_decision: "approved",
    p_signature_name: "  דנה לוי  ",
    p_ip: "203.0.113.9",
    p_reason: "",
  });
  check("approving returns ok", outcome === "ok", String(outcome));

  const { data: after } = await admin
    .from("quotes")
    .select("status, decided_at, decision_signature_name, decision_reason, total")
    .eq("id", q1.id)
    .single();

  check("the status became approved", after.status === "approved");
  check("decided_at was set", Boolean(after.decided_at));
  check(
    "the signature name was stored, trimmed",
    after.decision_signature_name === "דנה לוי",
    JSON.stringify(after.decision_signature_name),
  );
  check("no decline reason was smuggled in", after.decision_reason === null);
  check("the total the trigger computed survived", Number(after.total) === 100);

  /* ------------------------------------------------------- not decidable twice */
  const { data: replay } = await admin.rpc("record_quote_decision", {
    p_token: q1.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.9",
    p_reason: "changed my mind",
  });
  check("a second decision is refused", replay === "unchanged", String(replay));
  const { data: still } = await admin
    .from("quotes")
    .select("status, decision_reason")
    .eq("id", q1.id)
    .single();
  check("the first decision stands", still.status === "approved" && still.decision_reason === null);

  /* ------------------------------------------------------------- decline */
  const q2 = await newQuote();
  const { data: declined } = await admin.rpc("record_quote_decision", {
    p_token: q2.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.9",
    p_reason: "  יקר מדי  ",
  });
  check("declining returns ok", declined === "ok", String(declined));
  const { data: d } = await admin
    .from("quotes")
    .select("status, decision_reason, decision_signature_name")
    .eq("id", q2.id)
    .single();
  check("the status became declined", d.status === "declined");
  check("the reason was stored, trimmed", d.decision_reason === "יקר מדי");
  check("no signature name was smuggled in", d.decision_signature_name === null);

  /* --------------------------------------------------------- the guards */
  const q3 = await newQuote();
  const { data: noName } = await admin.rpc("record_quote_decision", {
    p_token: q3.public_token,
    p_decision: "approved",
    p_signature_name: "   ",
    p_ip: null,
    p_reason: "",
  });
  check("approving with no name returns missing_name", noName === "missing_name", String(noName));

  const { data: bogus } = await admin.rpc("record_quote_decision", {
    p_token: q3.public_token,
    p_decision: "maybe",
    p_signature_name: "x",
    p_ip: null,
    p_reason: "",
  });
  check("an unknown decision returns invalid", bogus === "invalid", String(bogus));

  const { data: unknownToken } = await admin.rpc("record_quote_decision", {
    p_token: "f".repeat(32),
    p_decision: "approved",
    p_signature_name: "דנה",
    p_ip: null,
    p_reason: "",
  });
  check("an unknown token returns unchanged", unknownToken === "unchanged", String(unknownToken));

  const { data: untouched } = await admin
    .from("quotes")
    .select("status")
    .eq("id", q3.id)
    .single();
  check("the guarded quote is still open", untouched.status === "sent");

  /* ------------- the notification, once 0016 has been applied ------------- */
  const { data: notes } = await admin
    .from("notifications")
    .select("kind, subject_name, quote_number, quote_id")
    .eq("business_id", biz.id);

  if (process.env.EXPECT_NOTIFICATION === "1") {
    check("approving raised exactly one notification", notes.length === 1, String(notes.length));
    check("it is a quote_approved", notes[0]?.kind === "quote_approved");
    check("it snapshotted the client's name", notes[0]?.subject_name === "דנה לוי");
    check("it snapshotted the quote number", notes[0]?.quote_number === q1.quote_number);
    check("it points at the quote", notes[0]?.quote_id === q1.id);
    check("declining raised nothing", notes.length === 1);
  } else {
    console.log("  [skip] notification checks (set EXPECT_NOTIFICATION=1 after 0016)");
  }
}

try {
  console.log("\nQuote approval behaviour\n");
  await run();
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
```

Add to `package.json`:

```json
"verify:quote-approval": "node --env-file=.env.local scripts/verify-quote-approval.mjs",
```

- [ ] **Step 2: Run it against the CURRENT function**

Run: `npm run verify:quote-approval`
Expected: all checks pass, with the notification checks skipped. **If anything fails here, stop** — the test is wrong, or the current behaviour is not what this task assumes. Do not apply the migration to make a failing test pass.

- [ ] **Step 3: Commit the test on its own**

```bash
git add scripts/verify-quote-approval.mjs package.json
git commit -m "Test the existing quote approval behaviour before changing it"
```

- [ ] **Step 4: Write the migration**

Copy `record_quote_decision` from `0005_quote_decisions.sql` and add exactly two things: the extra `returning` targets, and the insert. Every existing line, every return value and the signature stay byte-identical.

```sql
/*
  Tell the owner when a quote is approved.

  create or replace on the function from 0005, the same way 0012 replaced
  record_quote_view. The original migration file is not edited: a migration that
  has already run is a record of what happened, and rewriting it means a fresh
  database and an existing one stop agreeing.

  Everything about the function is unchanged. Same signature, same four return
  values, same guards, same WHERE clause that makes a second decision a no-op.
  Two additions and nothing else:

    1. the UPDATE also returns business_id and quote_number
    2. an approval inserts one notification

  A decline inserts nothing. The owner finds out about a decline by looking, and
  a notification for every outcome trains people to ignore all of them.

  The insert sits inside the same function as the update, so there is no state
  where a quote is approved and the owner was never told.

  Block comments only, so no editor can autocorrect a double dash.
*/

create or replace function public.record_quote_decision(
  p_token          text,
  p_decision       text,
  p_signature_name text,
  p_ip             text,
  p_reason         text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_business uuid;
  v_number   integer;
  v_client   uuid;
  v_name     text;
begin
  if p_decision not in ('approved', 'declined') then
    return 'invalid';
  end if;

  if p_decision = 'approved'
     and coalesce(btrim(p_signature_name), '') = '' then
    return 'missing_name';
  end if;

  update public.quotes
  set status = p_decision::public.quote_status,
      decided_at = now(),
      decision_ip = p_ip,
      decision_signature_name =
        case when p_decision = 'approved' then btrim(p_signature_name) end,
      decision_reason =
        case when p_decision = 'declined' then nullif(btrim(p_reason), '') end
  where public_token = p_token
    and status in ('draft', 'sent', 'viewed')
  returning id, business_id, quote_number, client_id
       into v_id, v_business, v_number, v_client;

  if v_id is null then
    /* Either the token is wrong, or this quote was already decided. */
    return 'unchanged';
  end if;

  if p_decision = 'approved' then
    select full_name into v_name from public.clients where id = v_client;

    insert into public.notifications
      (business_id, kind, subject_name, quote_number, quote_id)
    values
      (v_business, 'quote_approved', v_name, v_number, v_id);
  end if;

  return 'ok';
end;
$$;

revoke all on function public.record_quote_decision(text, text, text, text, text) from public;
revoke all on function public.record_quote_decision(text, text, text, text, text) from anon;
revoke all on function public.record_quote_decision(text, text, text, text, text) from authenticated;
```

- [ ] **Step 5: ASCII check, hand to the user, wait**

Same command as Task 1 Step 2. Tell the user plainly that this one replaces a function the approve button already depends on, and that the regression test above passed before and will be re-run after.

- [ ] **Step 6: Re-run the same test, now expecting the notification**

Run:

```bash
EXPECT_NOTIFICATION=1 npm run verify:quote-approval
```

Expected: every check from Step 2 still passes, **plus** the six notification checks. If any Step 2 check now fails, the migration changed behaviour — revert by re-applying the function body from `0005` and investigate before trying again.

- [ ] **Step 7: Run the public quote page end to end**

`verify:quote` drives the real approve button in a browser, which is the thing this touched:

```bash
npm run lint
npm run typecheck
npm run build
```

Start the server on 3100, then `npm run verify:quote`, then `npm run verify:notifications`, then the full existing suite.

- [ ] **Step 8: Commit and push**

```bash
git add supabase/migrations/0016_quote_approved_notification.sql
git commit -m "Notifications: tell the owner when a quote is approved"
git push
```

- [ ] **Step 9: Verify against production**

Once Vercel has deployed:

```bash
npm run verify:seo -- --url https://<production-domain>
npm run verify:quote -- --url https://<production-domain>
npm run verify:intake -- --url https://<production-domain>
```

**Slice 5 is complete. The feature is done. Report to the user.**

---

## Error handling summary

| Case | Where it is handled | Behaviour |
| --- | --- | --- |
| Form saved with no name | `readForm` in `forms/actions.ts` | Hebrew message in `Alert` |
| Form saved with no questions | `validateQuestions` | Hebrew message in `Alert` |
| Question prompt over 200 chars | `validateQuestions` + `maxLength` in the builder | rejected |
| Token unknown or malformed | `TOKEN_PATTERN` then `notFound()` | 404, still `noindex` |
| Request already submitted | `submit_intake_request`'s WHERE clause | thank-you state; the row is untouched |
| Choice answer not in the options | `validateAnswers` against the snapshot | rejected server-side |
| Free text over 1000 chars | `validateAnswers` + `maxLength` | rejected server-side |
| Client deleted after sending | `on delete cascade` | requests go with them |
| Saved form deleted | `on delete set null` | `form_id` clears; the answers survive |
| Notification's quote or request deleted | `on delete set null` | the row survives with its snapshotted text |
| A form with zero questions is sent | `validateQuestions` in `createIntakeRequestAction` | refused before a row exists |
