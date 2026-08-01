/*
  In-app notifications.

  There is no email infrastructure in this project. Adding a provider would mean
  a dependency, an API key, a domain to verify and a running cost, so these are
  in-app only and the owner sees them when they open the app. That is a real
  limitation, stated rather than hidden.

  What is stored is deliberately NOT a sentence. These rows are written by SQL
  functions, and every migration here is pure ASCII, so a Hebrew literal cannot
  appear in one. Instead the two facts that could disappear later (the client's
  name and the quote number) are snapshotted, and the wording is composed in
  TypeScript at render time. Same immunity to a client deleted next month; the
  copy stays where it can be changed without a migration.

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
