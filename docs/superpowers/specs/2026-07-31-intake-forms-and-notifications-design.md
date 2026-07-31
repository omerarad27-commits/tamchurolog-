# Intake forms and notifications

Date: 2026-07-31
Status: approved, not yet implemented

The owner builds a short questionnaire once, saves it under a name, and sends it
to a client on WhatsApp. The client answers on their phone. The answers come
back onto the client's card so the owner can price the job by hand.

Two notifications follow: one when a client submits a questionnaire, one when a
client approves a quote.

## Governing constraint

The request asks for surgical, non-breaking changes. Four subsystems in one
commit is what breaks stability, so this ships in five slices with approval
between each. Exactly one slice touches code that already works, and it is
last.

---

## 1. Data model

One migration, two tables.

```
intake_forms
  id           uuid  pk
  business_id  uuid  -> businesses(id) on delete cascade
  name         text  not null          -- "שאלון שיפוץ מקלחת"
  questions    jsonb not null          -- the builder's output
  created_at   timestamptz
  updated_at   timestamptz

intake_requests
  id            uuid  pk
  business_id   uuid  -> businesses(id) on delete cascade
  form_id       uuid  -> intake_forms(id) on delete set null
  client_id     uuid  -> clients(id)     on delete cascade
  public_token  text  unique  default replace(gen_random_uuid()::text, '-', '')
  questions     jsonb not null          -- snapshot, see below
  answers       jsonb                   -- null until submitted
  sent_at       timestamptz
  submitted_at  timestamptz
  created_at    timestamptz
```

### Questions are snapshotted at send time

`intake_requests.questions` is a copy, not a reference. If the owner edits a
saved form after sending it, the link already in a client's hands does not
change underneath them, and the answers stay attached to the questions that
were actually asked. This is the same principle that freezes a sent quote.

`form_id` is kept only so the owner can see which saved form a request came
from; `on delete set null` means deleting a form never deletes the answers it
produced.

### Why jsonb rather than normalised tables

Nothing ever queries inside the questions or the answers — they are rendered in
order and read by a human. Normalising would add two tables, two foreign keys
and two more RLS policies that nothing would use.

`quote_line_items` is normalised because its rows are summed, validated and
recalculated. There is no arithmetic here.

Shape:

```jsonc
// questions
[
  { "id": "q1", "kind": "choice", "prompt": "…", "options": ["לא","1","2","3","4"] },
  { "id": "q2", "kind": "text",   "prompt": "…" }
]

// answers — keyed by question id, so an answer can never drift onto the
// wrong question through reordering
{ "q1": "2", "q2": "יש מרפסת בצד האחורי" }
```

### RLS

Both tables: the owner may select, insert, update and delete only rows whose
`business_id` belongs to them, proven by joining back to `businesses` — the
pattern every existing table already uses. Anonymous visitors get nothing.

The public form page is read on the server with the service-role key on an
exact token match, exactly as `/q` is — see `src/lib/public-quote.ts`. There is
no anon policy on either table, so PostgREST stays completely closed: there is
no endpoint an anonymous visitor can call to list or filter these rows.

Writes go through a `security definer` function, as `record_quote_decision`
does, so "refuse a second submission" is enforced in SQL rather than in a
read-then-write race in TypeScript.

---

## 2. The question bank

Two built-in questions, defined in `src/lib/intake-bank.ts` as constants, not
in the database. They are part of the product rather than user data, so a
future third question is a code change with no migration.

```ts
{ key: "floor_elevator",
  prompt: "האם מדובר בבניין ללא מעלית, ואם כן באיזו קומה?",
  options: ["לא", "1", "2", "3", "4"] }

{ key: "parking",
  prompt: "האם יש חנייה זמינה ליד המבנה או אזור פריקה נוח?",
  options: ["חנייה חופשית", "בעייתי מאוד לחנות", "חניה קצת רחוקה מהמבנה"] }
```

The wording is copied into the form when it is built, so editing the bank later
never rewrites questionnaires that already exist.

Free-text questions are written by the owner. Custom multiple-choice questions
are **not** in scope — the request specifies a built-in bank plus free text.

---

## 3. Dashboard: the form library and builder

| Route | Purpose |
| --- | --- |
| `/dashboard/forms` | saved forms, newest first, and a "new form" button |
| `/dashboard/forms/new` | build and name a new form |
| `/dashboard/forms/[id]` | edit or delete a saved form |

The builder: a name field, the two bank questions as toggles, and a repeating
list of free-text questions with add and remove — the same interaction shape as
the quote builder's line items, which the owner already knows.

A form with no questions cannot be saved. A form with no name cannot be saved.
Both rejected with a Hebrew message in the existing `Alert`, matching the other
forms in the app.

Navigation: "שאלונים" is added to `DashboardNav`, which currently has four
tabs. Adding a fifth is the only change to that file.

---

## 4. Sending

On the client hub, a `<details>` labelled **שליחת שאלון** listing the saved
forms. Picking one runs a Server Action that creates an `intake_requests` row.
The page then shows that request in the intake section with a WhatsApp button
carrying `https://<site>/f/<token>`.

### Why two taps and not one

A browser blocks a popup opened after an `await`, which is why
`WhatsAppShareButton` is a real `<a>` clicked directly rather than a button
that opens a window once a server call returns. The token cannot exist before
the row does, so a single tap would have to either create the row first — the
blocked case — or pre-create a request for every saved form on page load,
littering the table with rows nobody sent.

The alternative, a GET link that creates the row and redirects to WhatsApp, is
worse than it looks: `next/link` prefetches, so merely hovering the list would
create rows.

So: pick the form, then send. The second tap is a real anchor and hands off to
the WhatsApp app natively.

Reuses `buildWhatsAppUrl` with a new message builder in `src/lib/whatsapp.ts`,
alongside the quote and reminder builders.

If the client has no phone, the same rule as everywhere else: the send still
works and WhatsApp asks who to send to.

---

## 5. The client's page: `/f/[public_token]`

A public page mirroring `/q/[public_token]` in every protective detail:

| Protection | Why |
| --- | --- |
| `robots: noindex, nofollow` in metadata | a client's answers must never reach a search index |
| `Referrer-Policy: no-referrer` in `next.config.ts` | the token is a bearer credential sitting in the URL |
| `Disallow: /f/` in `robots.ts` | a crawler should not reach it at all |
| proxy early return | nonce only, no Supabase round trip on the client's critical path |

Read by `loadPublicIntake(token)` in `src/lib/public-intake.ts`, the mirror of
`loadPublicQuote`: shape-check the token, then one exact-match lookup with the
service-role key, returning only the fields the page renders.

The page: business name, a short line saying why they were sent this, the
questions as radio groups and textareas, and one submit button. Mobile first,
RTL, built from existing tokens. No new colours, no libraries.

After submitting: a thank-you state. A second visit to a submitted request
shows the same state rather than an empty form, so a re-tapped WhatsApp link
cannot overwrite answers. Submission is refused server-side once
`submitted_at` is set.

---

## 6. Answers on the client hub

A section on `/dashboard/clients/[id]`, under the quotes list: each request as
a card with the form name, when it was sent, and either the answers in order or
"טרם נענה".

This is where the owner reads them while deciding a price. Nothing is
calculated from them.

---

## 7. Notifications

```
notifications
  id                 uuid pk
  business_id        uuid -> businesses(id) on delete cascade
  kind               text check (kind in ('intake_submitted','quote_approved'))
  subject_name       text               -- snapshot of the client's name
  quote_number       integer null       -- snapshot
  intake_request_id  uuid null
  quote_id           uuid null
  read_at            timestamptz null
  created_at         timestamptz
```

`subject_name` and `quote_number` are copied in at creation and never
recomputed, so a client deleted next month does not blank last month's
notifications.

The Hebrew sentence is **not** stored. It is composed at render time from
`kind`, `subject_name` and `quote_number`, because these rows are written by
SQL functions and every migration in this project is pure ASCII — a Hebrew
literal cannot appear in one. Snapshotting the two values rather than the
sentence gets the same immunity to later deletions and keeps the wording in the
codebase, where it can be changed without a migration.

In-app only. There is no email infrastructure in this project, and adding a
provider would mean a dependency, an API key, a domain to verify and a running
cost. The honest limitation: the owner sees these when they open the app.

A bell in the dashboard header — `src/app/dashboard/layout.tsx`, beside the
sign-out button — showing an unread count, linking to
`/dashboard/notifications`. Opening that page marks everything currently
unread as read, in one update. There is no per-item read control: the owner
came to look at them, and a list that needs dismissing one by one is a chore
rather than a feature.

### The two triggers

**Intake submitted** — written inside the same `security definer` function that
records the submission. The anonymous client has no rights to the notifications
table, and this is how the write happens without granting any.

**Quote approved** — the approval already runs inside a `security definer`
function created in `0005_quote_decisions.sql`. A new migration issues a
`create or replace` for it with the notification insert added, exactly as
`0012_view_by_token.sql` replaced `record_quote_view`. The existing migration
file is not edited.

This is the only change in the whole feature that touches working code, which
is why it is the last slice. Its verification asserts that approving a quote
still does everything it did before — sets the status, stores the signature and
the timestamp, freezes the quote — and only then that a notification appeared.

---

## Slices

| # | Slice | Touches existing code |
| --- | --- | --- |
| 1 | Migration, question bank, form library and builder | no |
| 2 | Send, `/f/[token]`, submission | additive only: proxy, robots, next.config, nav |
| 3 | Answers on the client hub | no |
| 4 | Notifications table, bell, list, intake trigger | no |
| 5 | Quote-approved notification | **yes** — the approval function |

Each slice: verified in a browser against a production build, full existing
suite re-run, committed, pushed, verified against production.

---

## Migrations

Delivered as SQL for the owner to run in the Supabase SQL editor, following the
existing convention: pure ASCII, `/* */` block comments only — never `--`,
because an editor can autocorrect a double dash and silently comment out a
statement.

---

## Error handling

| Case | Behaviour |
| --- | --- |
| Form saved with no name or no questions | rejected, Hebrew message in `Alert` |
| Token unknown or malformed | 404, `noindex` |
| Request already submitted | thank-you state; a second submit is refused server-side |
| Choice question submitted with a value not in its options | rejected server-side |
| Free-text over 1000 characters | rejected server-side, `maxLength` in the UI |
| Client deleted after sending | requests cascade away with them |
| Saved form deleted | `form_id` becomes null; the answers survive |

---

## Testing

`verify:forms` — build a form, save it, reload, confirm it persisted; reject an
empty name and an empty form.

`verify:intake` — send to a client, open `/f/<token>` as an anonymous browser,
answer, submit; confirm the answers land in the database keyed by question id;
confirm a second submit is refused; confirm `noindex` and the `no-referrer`
header; confirm the answers render on the client hub.

`verify:notifications` — submitting raises one; the count is per business;
another business never sees it; opening the list marks it read.

`verify:quote-approval-unchanged` — the existing approval behaviour, asserted
before and after slice 5.

The full existing suite (`csp`, `redirect`, `quote`, `seo`, `a11y`, `auth`,
`settings`, `bidi`, `contact`, `client-hub`, `landing`) must pass after every
slice.

---

## Out of scope

- Image upload, as specified.
- Custom multiple-choice questions written by the owner.
- Email, SMS or push notification delivery.
- Any automatic pricing from answers. Pricing stays manual, as specified.
- Editing a questionnaire that has already been sent.
