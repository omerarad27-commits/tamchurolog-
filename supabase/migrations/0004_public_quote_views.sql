/*
  Phase 4: public quote page and view tracking.

  Security model for the public page, stated explicitly:

  There is NO anon policy on quotes or quote_line_items, and none is added here.
  The public page is rendered on the server with the service_role key, filtering
  by an exact public_token match. That means the PostgREST API stays completely
  closed to the public: there is no endpoint an anonymous visitor can call to
  list, filter, or page through quotes, so enumeration is not merely blocked,
  it is unreachable.

  The alternative (an anon SELECT policy on quotes) was rejected: it would open
  the REST endpoint to anonymous callers, and the moment a filter is expressed
  as a query parameter the client controls, a policy mistake turns into a full
  table leak. Keeping the table closed and reading it only through one server
  route with a single exact-match lookup is the smaller attack surface.

  quote_view_events is written by that same server route with the service key.
  Owners can read their own events; nobody else can read anything.

  Block comments only, so no editor can autocorrect a double dash.
*/

/* ================== view timestamps on the quote ================== */

alter table public.quotes
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz;

/* ======================= quote_view_events ======================= */

create table if not exists public.quote_view_events (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists quote_view_events_quote_id_idx
  on public.quote_view_events (quote_id, viewed_at desc);

alter table public.quote_view_events enable row level security;

/*
  Read-only for the owner of the quote. No insert policy for authenticated
  users: events are recorded server side with the service key, which bypasses
  RLS, so no client-facing role needs write access here.
*/

drop policy if exists quote_view_events_select_own on public.quote_view_events;
create policy quote_view_events_select_own on public.quote_view_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_view_events.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ==================== record a view atomically ==================== */

/*
  Doing this in one function rather than several round trips keeps the status
  transition honest:

  * first_viewed_at is only ever set once
  * last_viewed_at moves on every view
  * status becomes 'viewed' only when it is currently 'sent'

  That last rule is what stops a client who revisits the link after approving
  from dragging an approved quote back to 'viewed'.
*/

create or replace function public.record_quote_view(
  p_quote_id   uuid,
  p_ip_address text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quote_view_events (quote_id, ip_address, user_agent)
  values (p_quote_id, p_ip_address, p_user_agent);

  update public.quotes
  set first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now(),
      status = case when status = 'sent' then 'viewed' else status end
  where id = p_quote_id;
end;
$$;

/* Only the server route, which uses the service key, may call this. */
revoke all on function public.record_quote_view(uuid, text, text) from public;
revoke all on function public.record_quote_view(uuid, text, text) from anon;
revoke all on function public.record_quote_view(uuid, text, text) from authenticated;
