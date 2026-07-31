# Client hub, landing page, and Google sign-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client page into a working hub, put a converting landing page on `/`, and add Google sign-in with a completion screen for the business name.

**Architecture:** Three independent slices, committed separately in increasing order of risk. Slice 1 and 2 are server components reusing existing helpers and components. Slice 3 adds two GET route handlers and one guarded page, and touches authentication.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), Supabase (`@supabase/ssr`), Tailwind v4, Playwright for verification.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-31-client-hub-landing-google-design.md`. It governs; this plan implements it.
- **Read `node_modules/next/dist/docs/` before using any Next API.** AGENTS.md: this is not the Next.js you know, and `priority` was already found deprecated this way.
- No new dependencies. No new colours. Use existing tokens in `globals.css`.
- Do not touch: `/q/*`, `next.config.ts`, `src/proxy.ts` CSP code, `src/lib/supabase/cookie-options.ts`, `supabase/migrations/*`, RLS.
- Every commit must pass: `npm run lint`, `npm run typecheck`, `npm run build`.
- **Never chain `npm run lint` through a pipe in a `&&` chain** — the pipeline returns `tail`'s exit code and a real lint error passed silently once already.
- Verification scripts run against a production build on port 3100, not the dev server.
- The full existing suite must pass after each slice: `csp`, `redirect`, `quote`, `seo`, `a11y`, `auth`, `settings`, `bidi`.

---

## Task 1: WhatsApp chat link helper

**Files:**
- Modify: `src/lib/whatsapp.ts`
- Test: `scripts/verify-bidi.mjs` pattern — pure function, checked in `scripts/verify-contact-links.mjs` (create)

**Interfaces:**
- Produces: `buildWhatsAppChatUrl(phone: string | null): WhatsAppTarget` — same return shape as the existing `buildWhatsAppUrl`, no `?text=`.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-contact-links.mjs`:

```js
/**
 * Unit checks for the contact links on the client hub.
 *
 * A wrong tel: or wa.me number does not throw - it silently calls the wrong
 * person, which is the failure worth a test.
 */
import { buildWhatsAppChatUrl } from "../src/lib/whatsapp.ts";
import { normalizeIsraeliPhone } from "../src/lib/phone.ts";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

console.log("\nContact links\n");

const local = buildWhatsAppChatUrl("054-123-4567");
check("a local number becomes an international wa.me link",
  local.url === "https://wa.me/972541234567", local.url);
check("it reports having a recipient", local.hasRecipient === true);
check("no prefilled message", !local.url.includes("text="), local.url);

const none = buildWhatsAppChatUrl(null);
check("a missing number still opens WhatsApp", none.url.startsWith("https://wa.me/"), none.url);
check("but reports no recipient", none.hasRecipient === false);

const junk = buildWhatsAppChatUrl("not a phone");
check("an invalid number reports no recipient", junk.hasRecipient === false, junk.url);

check("tel: uses E.164",
  normalizeIsraeliPhone("054-123-4567")?.e164 === "+972541234567",
  normalizeIsraeliPhone("054-123-4567")?.e164);

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
```

Add to `package.json` scripts: `"verify:contact": "node --experimental-strip-types scripts/verify-contact-links.mjs"`

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run verify:contact`
Expected: fails to import — `buildWhatsAppChatUrl` does not exist.

- [ ] **Step 3: Implement**

Append to `src/lib/whatsapp.ts`:

```ts
/**
 * A plain chat with the client, with no message written for them.
 *
 * Separate from buildWhatsAppUrl because the intent is different: that one
 * delivers a quote and always carries text, this one just opens the
 * conversation. Both go through normalizeIsraeliPhone, so there is one
 * definition of what a valid Israeli number is.
 */
export function buildWhatsAppChatUrl(phone: string | null): WhatsAppTarget {
  const normalized = phone ? normalizeIsraeliPhone(phone) : null;

  if (!normalized) {
    return { url: "https://wa.me/", hasRecipient: false };
  }

  return { url: `https://wa.me/${normalized.wa}`, hasRecipient: true };
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npm run verify:contact`
Expected: `7/7 checks passed.`

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts scripts/verify-contact-links.mjs package.json
git commit -m "Add a plain WhatsApp chat link beside the quote-sending one"
```

---

## Task 2: `initialClientId` on the quote builder

**Files:**
- Modify: `src/app/dashboard/quotes/quote-builder.tsx`
- Modify: `src/app/dashboard/quotes/new/page.tsx`

**Interfaces:**
- Produces: `QuoteBuilder` accepts `initialClientId?: string`. Absent ⇒ behaviour identical to today.
- Produces: `/dashboard/quotes/new?clientId=<uuid>` preselects that client.

- [ ] **Step 1: Add the prop**

In `quote-builder.tsx`, add to the props type after `defaultWithVat`:

```ts
  /**
   * Preselects a client when arriving from that client's page.
   *
   * Deliberately not folded into `draft`: `draft` means "editing an existing
   * quote" and switches the form to updateQuoteAction, so using it to carry a
   * client id would turn a new quote into an update of a quote that does not
   * exist.
   */
  initialClientId?: string;
```

Destructure it alongside `draft`, and change the initial state:

```ts
  const [clientId, setClientId] = useState(
    draft?.clientId ??
      initialClientId ??
      (clients.length === 1 ? clients[0].id : ""),
  );
```

- [ ] **Step 2: Read the param on the new-quote page**

In `src/app/dashboard/quotes/new/page.tsx`, change the signature to take
`PageProps<"/dashboard/quotes/new">`, await `searchParams`, and validate:

```ts
export default async function NewQuotePage({
  searchParams,
}: PageProps<"/dashboard/quotes/new">) {
  const { supabase, business } = await requireBusiness();
  const { clientId } = await searchParams;
  ...
  const clients = (data ?? []) as Client[];

  /*
   * Only a client this business actually owns. The list above is already
   * scoped to the business, so membership in it is the whole check; an
   * unknown id opens the builder with nothing selected rather than an error,
   * because the owner is one dropdown away from carrying on.
   */
  const requested = typeof clientId === "string" ? clientId : undefined;
  const initialClientId = clients.some((c) => c.id === requested)
    ? requested
    : undefined;
```

Pass `initialClientId={initialClientId}` to `<QuoteBuilder>`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/quotes/quote-builder.tsx src/app/dashboard/quotes/new/page.tsx
git commit -m "Let a new quote arrive with its client already chosen"
```

---

## Task 3: The client hub page

**Files:**
- Modify: `src/app/dashboard/clients/[id]/page.tsx`
- Test: `scripts/verify-client-hub.mjs` (create)

**Interfaces:**
- Consumes: `buildWhatsAppChatUrl` (Task 1), `initialClientId` route (Task 2).

- [ ] **Step 1: Write the failing verification**

Create `scripts/verify-client-hub.mjs` following the shape of
`scripts/verify-settings-notice.mjs`: seed a business with two clients, give
client A two quotes and client B one, sign in, then assert against
`/dashboard/clients/<A>`:

- the page lists A's two quote numbers
- B's quote number is absent
- the WhatsApp link href is `https://wa.me/972541234567`
- the call link href is `tel:+972541234567`
- a client with no phone shows neither link and shows `חסר טלפון`
- the new-quote button href contains `clientId=<A>`
- following it lands on the builder with A selected in the `clientId` select
- the builder still submits to create: after filling one line and saving, a
  **third** quote exists for A
- expanding `עריכת פרטי הלקוח` and saving a new name still persists

Add `"verify:client-hub": "node --env-file=.env.local scripts/verify-client-hub.mjs"`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run verify:client-hub`
Expected: failures on the quote list, both contact links and the new-quote button — the page is still the edit form.

- [ ] **Step 3: Rewrite the page**

Replace `src/app/dashboard/clients/[id]/page.tsx`. Structure:

```tsx
// after loading the client, load their quotes
const { data: quoteRows } = await supabase
  .from("quotes")
  .select("id, quote_number, status, total, issued_at")
  .eq("client_id", id)
  .eq("business_id", business.id)
  .order("issued_at", { ascending: false });
```

Render, in order: back link, `<h1>` name, phone line, contact buttons
(`buildWhatsAppChatUrl` + `tel:`) only when `client.phone` normalizes, the
new-quote `ButtonLink` to `/dashboard/quotes/new?clientId=${client.id}`, the
quote list reusing `StatusBadge` and `formatILS`, then:

```tsx
<details className="rounded-card border border-border bg-surface">
  <summary className="cursor-pointer px-5 py-4 font-semibold">
    עריכת פרטי הלקוח
  </summary>
  <div className="flex flex-col gap-4 border-t border-border p-5">
    <ClientForm client={client} />
    <DeleteClientButton id={client.id} fullName={client.full_name} />
  </div>
</details>
```

`ClientForm` and `DeleteClientButton` are passed exactly the props they get
today.

- [ ] **Step 4: Run the verification**

Run: `npm run verify:client-hub`
Expected: all checks pass.

- [ ] **Step 5: Regression suite**

Run each separately (not piped in a `&&` chain):
`npm run lint`, `npm run typecheck`, `npm run build`, then
`npm run verify:auth -- --url http://localhost:3100` and `verify:settings`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/clients/ scripts/verify-client-hub.mjs package.json
git commit -m "Make the client page a hub instead of a lone edit form"
```

---

## Task 4: Landing page

**Files:**
- Modify: `src/app/page.tsx`
- Test: `scripts/verify-landing.mjs` (create)

- [ ] **Step 1: Write the failing verification**

Create `scripts/verify-landing.mjs` asserting on `/`:
- the three value points are present
- a signup form with `businessName`, `email`, `password` fields exists
- signing up from `/` reaches `/dashboard` and creates a business with that name
- a signed-in visitor sees a dashboard link and **no** signup form
- `/login` and `/signup` still answer 200
- the canonical tag is still present (guards the SEO work)

Add `"verify:landing": "node --env-file=.env.local scripts/verify-landing.mjs"`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run verify:landing`
Expected: fails — there is no form on `/`.

- [ ] **Step 3: Rewrite the page**

Keep `metadata` with `alternates.canonical`, keep `getUser()`, keep the
dev-only health card at the bottom. Widen the container from `max-w-md` to a
landing width, with the auth card at form width. Render `<SignupForm />` from
`@/app/(auth)/signup/signup-form` when signed out.

- [ ] **Step 4: Run the verification and the SEO suite**

Run: `npm run verify:landing`, then `npm run verify:seo`.
Expected: both pass — the SEO run proves the canonical and manifest survived.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx scripts/verify-landing.mjs package.json
git commit -m "Give the home page a landing and the signup form itself"
```

---

## Task 5: Google sign-in routes and button

**Files:**
- Create: `src/app/auth/google/route.ts`, `src/app/auth/callback/route.ts`,
  `src/components/google-sign-in-button.tsx`
- Modify: `src/app/page.tsx`, `src/app/(auth)/login/page.tsx`,
  `src/app/(auth)/signup/page.tsx`

**Interfaces:**
- Produces: `GET /auth/google?next=<path>` → 3xx to `accounts.google.com`.
- Produces: `GET /auth/callback?code=<code>&next=<path>` → session + redirect.
- Produces: `<GoogleSignInButton next?: string />`.

- [ ] **Step 1: Read the docs first**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
before writing either handler. Confirm the handler signature and how to return
a redirect in this version.

- [ ] **Step 2: Write the route handlers**

`/auth/google` calls
`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } })`
and redirects to `data.url`. `redirectTo` is
`${origin}/auth/callback?next=${encodeURIComponent(safeRedirectPath(next))}`.

`/auth/callback` calls `supabase.auth.exchangeCodeForSession(code)`. On error or
missing code, redirect to `/login`. On success, redirect to
`safeRedirectPath(next)`.

- [ ] **Step 3: Write the button**

A server component rendering an `<a href={`/auth/google?next=${...}`}>` with the
Google mark as inline SVG and `buttonClasses({ variant: "secondary" })`. A
comment must record why it is a link: `form-action 'self'` in our CSP is applied
by Chrome to redirects following form submissions.

- [ ] **Step 4: Place the button**

On `/`, `/login` and `/signup`, above the form, with a divider reading `או`.

- [ ] **Step 5: Build and check the redirect**

Run: `npm run build`, restart on 3100, then
`curl -sI "http://localhost:3100/auth/google" | head -5`.
Expected: a 3xx whose `location` is `accounts.google.com` **if** the provider is
configured; a redirect back to `/login` if not. Record which.

- [ ] **Step 6: Commit**

```bash
git add src/app/auth src/components/google-sign-in-button.tsx src/app/page.tsx "src/app/(auth)"
git commit -m "Add Google sign-in, as a link because form-action would refuse a form"
```

---

## Task 6: The `/welcome` completion screen and its guard

**Files:**
- Create: `src/app/welcome/page.tsx`, `src/app/welcome/actions.ts`
- Modify: `src/app/dashboard/layout.tsx`, `src/proxy.ts`
- Test: `scripts/verify-welcome.mjs` (create)

- [ ] **Step 1: Write the failing verification**

Create `scripts/verify-welcome.mjs`. Seed a user **through the admin API with no
`business_name`** — this reproduces exactly what Google produces — then:
- visiting `/dashboard` redirects to `/welcome`
- visiting `/dashboard/settings` also redirects to `/welcome`
- submitting the form writes `name` and `business_type` and lands on `/dashboard`
- afterwards `/dashboard` no longer redirects
- a normally-seeded user is never sent to `/welcome`
- signed out, `/welcome` redirects to `/login`

Add `"verify:welcome": "node --env-file=.env.local scripts/verify-welcome.mjs"`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run verify:welcome`
Expected: `/dashboard` renders normally instead of redirecting; `/welcome` 404s.

- [ ] **Step 3: Build the page and action**

`/welcome` calls `requireBusiness()`, redirects to `/dashboard` if the name is
already set, and renders a `TextField` for the name plus `BusinessTypePicker`.
The action validates a non-empty name (same message as settings), updates the
row, `revalidatePath("/dashboard", "layout")`, and redirects to `/dashboard`.

- [ ] **Step 4: Add the guard**

In `src/app/dashboard/layout.tsx`, after `requireBusiness()`:

```tsx
  /*
   * A business with no name is one that arrived through Google, where the
   * signup trigger had no business_name to read. That name is what every
   * client sees at the top of every quote, so it is collected before the
   * dashboard opens. /welcome sits outside /dashboard, so this cannot loop.
   */
  if (!business.name.trim()) redirect("/welcome");
```

Add `"/welcome"` to `PROTECTED_PREFIXES` in `src/proxy.ts`.

- [ ] **Step 5: Run the verification**

Run: `npm run verify:welcome`
Expected: all checks pass.

- [ ] **Step 6: Full regression**

Run each separately: `lint`, `typecheck`, `build`, then `verify:csp`,
`verify:redirect`, `verify:quote`, `verify:seo`, `verify:a11y`, `verify:auth`,
`verify:settings`, `verify:bidi`, `verify:client-hub`, `verify:landing`.

- [ ] **Step 7: Commit**

```bash
git add src/app/welcome src/app/dashboard/layout.tsx src/proxy.ts scripts/verify-welcome.mjs package.json
git commit -m "Collect the business name when Google signup could not supply one"
```

---

## Task 7: Configuration instructions

**Files:**
- Create: `docs/google-sign-in-setup.md`

- [ ] **Step 1: Write the steps**

Exact click-path for Google Cloud Console (OAuth client, authorized redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`), Supabase Providers, and
the Supabase redirect allow list entry
`https://tamchurolog.vercel.app/auth/callback`. Include how to verify: run
`npm run verify:google -- --url https://tamchurolog.vercel.app` and expect the
redirect to reach `accounts.google.com`.

- [ ] **Step 2: Commit**

```bash
git add docs/google-sign-in-setup.md
git commit -m "Write down the Google sign-in configuration steps"
```

---

## Self-review notes

- Spec coverage: client hub §1 → Tasks 1+3; quote-for-client §2 → Task 2;
  landing §3 → Task 4; Google §4 → Tasks 5+6+7. Error-handling table covered by
  the checks in Tasks 3, 5, 6.
- Type consistency: `buildWhatsAppChatUrl` returns `WhatsAppTarget` in Task 1
  and is consumed as `{ url, hasRecipient }` in Task 3. `initialClientId` is
  named identically in Tasks 2 and 3.
- Risk order: Tasks 1–3 touch no auth. Task 6 is the only one that can lock a
  user out, and its verification covers both the redirect and its absence.
