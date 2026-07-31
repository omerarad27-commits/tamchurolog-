# Client hub, landing page, and Google sign-in

Date: 2026-07-31
Status: approved, not yet implemented

Four features requested together. They touch three unrelated parts of the app,
so they ship as three commits in increasing order of risk: the client hub first
(daily value, no auth surface), the landing page second, Google sign-in last
(touches authentication and needs configuration outside this repository).

Nothing outside the files listed here is modified. In particular the dashboard,
the public quote page, the CSP, the session cookie options and the RLS policies
are untouched.

---

## 1. Client hub

### The problem

`/dashboard/clients/[id]` is an edit form and nothing else. From a client's page
there is no way to see what has been quoted to them, and no way to start a quote
for them — the owner has to go back out to the dashboard, start a blank quote,
and find the client again in a dropdown.

### Shape

The page becomes a hub, in the order the owner needs it:

```
‹ חזרה ללקוחות
רמי כהן
054-1234567

[ וואטסאפ ]  [ התקשר ]

[ + הצעת מחיר חדשה ]

הצעות (4)
  #1042   אושרה    ₪4,250   12.06.2026
  #1031   נצפתה    ₪1,800   03.06.2026
  ...

› עריכת פרטי הלקוח        (collapsed <details>)
```

Editing is demoted rather than removed. It is the rarest thing done on this
page and it currently occupies all of it. `ClientForm` and `DeleteClientButton`
move inside a `<details>` element unchanged — no props change, no logic changes,
so the existing save and delete flows keep working exactly as they do now.

`<details>` rather than a state-driven accordion: it needs no client JavaScript,
it is keyboard accessible and screen-reader announced for free, and this page is
otherwise a server component.

### Data

One additional query, in the existing `requireBusiness()` scope:

```
quotes
  select id, quote_number, status, total, issued_at, sent_at
  where client_id = <id> and business_id = <business.id>
  order by issued_at desc
```

`business_id` is filtered even though RLS already scopes the table to the
owner's rows. The filter costs nothing, and a query that states its own
assumptions does not depend on a policy elsewhere staying correct.

Empty state: a short line and the same "new quote" button, rather than an empty
list.

### Contact actions

Two plain anchors, no client component:

- WhatsApp → `https://wa.me/<international digits>` with no prefilled message.
- Call → `tel:<e164>`.

Both are rendered only when the client has a usable phone number. When there is
none, the existing `חסר טלפון` warning is shown in their place. A disabled
button that does not say why it is disabled is worse than no button.

`buildWhatsAppChatUrl(phone)` is added to `src/lib/whatsapp.ts` beside the
existing `buildWhatsAppUrl`, sharing `normalizeIsraeliPhone`. Two functions,
one definition of what a valid Israeli number is.

### Files

| File | Change |
| --- | --- |
| `src/app/dashboard/clients/[id]/page.tsx` | rewritten as the hub |
| `src/lib/whatsapp.ts` | add `buildWhatsAppChatUrl` |
| `src/app/dashboard/clients/client-form.tsx` | untouched |
| `src/app/dashboard/clients/delete-client-button.tsx` | untouched |

---

## 2. New quote for a specific client

`/dashboard/quotes/new?clientId=<id>` opens the builder with that client
selected.

### The trap this avoids

`QuoteBuilder` already accepts a `draft` prop containing a `clientId`, which
looks like the obvious way to preselect one. It is not:

```ts
const isEdit = Boolean(draft);
const [state, formAction] = useActionState(
  isEdit ? updateQuoteAction : createQuoteAction, ...
);
```

Passing a `draft` to preselect a client would switch the form from creating a
quote to updating one that does not exist.

Instead a separate optional prop is added:

```ts
initialClientId?: string;
...
const [clientId, setClientId] = useState(
  draft?.clientId ?? initialClientId ?? (clients.length === 1 ? clients[0].id : ""),
);
```

Purely additive. With the prop absent, every existing behaviour is bit for bit
what it is today, including the "one client, preselect it" convenience.

### Validation

The page already loads the business's clients. The `clientId` from the query
string is accepted only if it appears in that list; anything else is ignored and
the builder opens with no selection. An unknown id is not an error worth a
message — the owner is one dropdown away from continuing.

### Files

| File | Change |
| --- | --- |
| `src/app/dashboard/quotes/new/page.tsx` | read `searchParams.clientId`, validate against loaded clients, pass through |
| `src/app/dashboard/quotes/quote-builder.tsx` | add `initialClientId` prop, use in initial state |

---

## 3. Landing page with an inline signup form

### Shape

`/` becomes a short landing page. Content, top to bottom:

1. Brand mark and one-line positioning statement.
2. Three value points, each one line: send on WhatsApp, see when it was opened,
   the client approves with one tap. These are the three things the product
   actually does, stated as outcomes.
3. Sign-in card: Google button, a divider, then the signup form.
4. A link to `/login` for people who already have an account.

Minimal and built from the existing design tokens — no new colours, no new
fonts, no libraries. Type scale, radii and spacing come from `globals.css` as
they stand.

### Reuse, not duplication

The card renders the existing `SignupForm` component. There is one signup form
in the codebase and it stays that way.

`/login` and `/signup` continue to exist: `proxy.ts` redirects signed-in users
away from them by exact pathname, the `?next=` flow lands on `/login`, and there
are existing links to both. Removing them would be a second change wearing the
first one's clothes.

A signed-in visitor continues to see a link to the dashboard instead of the
form, exactly as today.

The development-only Supabase health card stays. It is gated on
`NODE_ENV !== "production"` and earns its place: the missing-env branch names
which variables are unset. It moves to the bottom of the new page.

### Files

| File | Change |
| --- | --- |
| `src/app/page.tsx` | rewritten as the landing page, health card retained |
| `src/app/(auth)/signup/signup-form.tsx` | reused as-is |

---

## 4. Google sign-in

### Pieces

| Route | Type | Purpose |
| --- | --- | --- |
| `/auth/google` | Route Handler (GET) | starts the flow, redirects to Google |
| `/auth/callback` | Route Handler (GET) | exchanges the code for a session |
| `/welcome` | Page | completes the business name after a Google signup |

### Why the button is a link and not a form

The site sends `form-action 'self'` in its CSP. Chrome applies `form-action` to
the redirect that *follows* a form submission, not only to the form's own
target, so a Server Action that redirects to `accounts.google.com` is refused.
A plain link is an ordinary top-level navigation and is not covered by
`form-action`.

This is the kind of failure that only appears in production, so it is designed
around rather than discovered.

The Google mark is inlined SVG. No external image request, nothing new for the
CSP to allow.

### Where the button appears

Three places, all rendering the same component: the landing page, `/signup`,
and `/login`. Someone who created their account with Google will come back and
look for it on the login screen, and not finding it there is the same failure
as not having it at all.

### Signing in with Google using an email that already has a password

Supabase decides this, not us: depending on the project's identity-linking
setting it either links the identities or refuses. We do not attempt to
influence it. Whatever it returns is surfaced through `hebrewAuthError` like
every other auth failure, so the owner reads a Hebrew sentence rather than a
provider error code. Deliberately linking providers is out of scope below.

### The business-name problem

`handle_new_user` in `0001_auth_businesses_clients.sql` creates the business row
from `raw_user_meta_data ->> 'business_name'`, defaulting to an empty string.
Google sends no such field, so a Google signup produces a business with no name.

That name is what every client sees at the top of every quote and on the
WhatsApp preview card. An empty one is not a cosmetic problem.

So: after sign-in, a business whose name is empty is sent to `/welcome`, which
asks for the business name and the business type (the latter decides VAT) and
writes both, then continues to the dashboard.

The guard lives in `src/app/dashboard/layout.tsx`, which wraps every dashboard
route and already calls `requireBusiness()`. `/welcome` sits outside
`/dashboard`, so there is no redirect loop. The database trigger is **not**
modified — it is the thing that guarantees a user can never exist without a
business, and this problem does not require weakening it.

`/welcome` is added to `PROTECTED_PREFIXES` in `proxy.ts` so that signed-out
visitors are sent to login.

### Existing users are unaffected

Everyone who signed up with a password has a business name already, so the
guard never fires for them.

### Configuration outside this repository

Not implementable in code; instructions will be written out:

1. Google Cloud Console → OAuth 2.0 Client ID, with the authorized redirect URI
   set to `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google → paste the Client ID and
   secret.
3. Supabase → Authentication → URL Configuration → add
   `https://tamchurolog.vercel.app/auth/callback` to the redirect allow list.

### Files

| File | Change |
| --- | --- |
| `src/app/auth/google/route.ts` | new |
| `src/app/auth/callback/route.ts` | new |
| `src/app/welcome/page.tsx` | new |
| `src/app/welcome/actions.ts` | new |
| `src/components/google-sign-in-button.tsx` | new |
| `src/app/(auth)/login/page.tsx` | render the button |
| `src/app/(auth)/signup/page.tsx` | render the button |
| `src/app/dashboard/layout.tsx` | add the empty-name guard |
| `src/proxy.ts` | add `/welcome` to `PROTECTED_PREFIXES` |
| `supabase/migrations/*` | unchanged |

---

## Error handling

| Case | Behaviour |
| --- | --- |
| `?clientId=` unknown or belonging to another business | ignored, builder opens with no client selected |
| Client with no phone | contact buttons absent, existing `חסר טלפון` warning shown |
| Client with no quotes | short empty line plus the new-quote button |
| OAuth callback without a `code` | redirect to `/login` with the standard error message |
| OAuth callback with an invalid code | redirect to `/login`, message in Hebrew via `hebrewAuthError` |
| `?next=` on the OAuth flow | passed through `safeRedirectPath`, same rule as password sign-in |
| Business name still empty after `/welcome` | the form rejects it, same validation as settings |

---

## Testing

Each part gets a browser-driven script in `scripts/`, run against a production
build, matching the existing `verify:*` convention.

**`verify:client-hub`**
- the hub lists only that client's quotes, and lists all of them
- a quote belonging to a different client of the same business is absent
- the WhatsApp href carries the client's number in international form
- the `tel:` href is the same number in E.164
- a client with no phone renders neither button and shows the warning
- "new quote" lands on the builder with that client already selected
- the builder still **creates** rather than updates (the `draft` trap)
- editing the client from the collapsed section still saves

**`verify:landing`**
- the landing page renders the value points and the signup form
- signing up from the landing page reaches the dashboard and creates a business
- a signed-in visitor sees the dashboard link and no form
- `/login` and `/signup` still work

**`verify:google`**
- `/auth/google` answers 3xx toward `accounts.google.com` with the expected
  `client_id` and `redirect_uri` (skipped with a clear message when the provider
  is not configured yet)
- `/auth/callback` without a code redirects to `/login` rather than erroring
- a user whose business name is empty is redirected to `/welcome` from any
  dashboard route
- completing `/welcome` writes both fields and reaches the dashboard
- a user with a business name is never sent to `/welcome`

The full existing suite (`csp`, `redirect`, `quote`, `seo`, `a11y`, `auth`,
`settings`, `bidi`) must still pass after each of the three commits.

---

## Explicitly out of scope

- Refactoring the dashboard's quote row into a shared component. The client hub
  row is simpler — no reminder button — and rewriting the dashboard to share it
  would put a working screen at risk for no gain here.
- Linking other providers to an existing password account.
- Changing `handle_new_user` or any migration.
- Any change to `/q`, the CSP, cookie options, or RLS.
