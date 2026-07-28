# תמחורולוג (Tamchurolog)

Quote-tracking web app for Israeli service tradespeople. Every quote gets a trackable
public link, so the owner can see when a client opened it, spot deals going cold, and
send a one-tap WhatsApp reminder.

All user-facing UI is Hebrew, RTL, mobile-first. Code and comments are English.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage)
- Deployed on Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000 — the home page runs a live Supabase connectivity check.

### Environment variables

| Variable | Exposed to browser | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key; all queries go through Row Level Security |
| `SUPABASE_SERVICE_ROLE_KEY` | **no — secret** | Server-only. Bypasses RLS. Used by `src/lib/supabase/admin.ts` |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL for building public quote links |

The same four variables must be set in Vercel under Project Settings → Environment
Variables for Production, Preview and Development.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Structure

```
src/
  app/            # routes (App Router)
  lib/
    env.ts        # public env access + validation
    supabase/
      client.ts   # browser client (anon key, RLS applies)
      server.ts   # server client (anon key + auth cookies, RLS applies)
      admin.ts    # service_role client, server-only, RLS bypassed
      health.ts   # connectivity check used by the home page
```
