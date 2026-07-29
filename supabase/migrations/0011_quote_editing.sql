/*
  Editing a quote after it was sent.

  The hard part is not the edit, it is the link that is already sitting in the
  client's WhatsApp. If the owner corrects a price, that old link must stop
  showing the old numbers immediately, or a client can approve a version the
  business no longer stands behind.

  So an edit to a quote that has already gone out rotates public_token. The old
  token is kept here, and the public page answers it with "this quote was
  cancelled" rather than a 404. A 404 would read as a broken link and invite
  the client to just use the screenshot they took; a clear cancellation tells
  them to expect a new one.

  A quote that was never sent has no link in anyone's hands, so editing a draft
  leaves its token alone.

  Nothing here decides when an edit is allowed. That is enforced in the action,
  and by the check below that a decided quote cannot be edited at all.

  Block comments only, so no editor can autocorrect a double dash.
*/

create table if not exists public.quote_revoked_tokens (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes (id) on delete cascade,
  token      text not null unique,
  revoked_at timestamptz not null default now()
);

create index if not exists quote_revoked_tokens_token_idx
  on public.quote_revoked_tokens (token);

create index if not exists quote_revoked_tokens_quote_id_idx
  on public.quote_revoked_tokens (quote_id, revoked_at desc);

alter table public.quote_revoked_tokens enable row level security;

/*
  Readable by the owner of the quote. No insert policy for authenticated users:
  revocation happens inside a security definer function so the old token and
  the new one are swapped in a single statement, never leaving a window where
  both work or neither does.
*/

drop policy if exists quote_revoked_tokens_select_own on public.quote_revoked_tokens;
create policy quote_revoked_tokens_select_own on public.quote_revoked_tokens
  for select to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_revoked_tokens.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ==================== rotate the link atomically ==================== */

/*
  Called when an already-sent quote is edited.

  Everything that described the previous version is cleared: it was sent, it
  may have been viewed, it may have been chased. None of that is true of the
  version the owner is about to produce, and leaving those timestamps in place
  would show a quote as "viewed" when what was viewed no longer exists.

  Refuses outright on a decided quote. The application checks this too, but a
  client's approval is the one thing that must not be editable out from under
  them, so it is also refused here where no code path can skip it.
*/

create or replace function public.rotate_quote_token(p_quote_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  old_token text;
  new_token text;
  current_status public.quote_status;
begin
  select public_token, status
  into old_token, current_status
  from public.quotes
  where id = p_quote_id
  for update;

  if old_token is null then
    return null;
  end if;

  if current_status in ('approved', 'declined') then
    raise exception 'cannot rotate the token of a decided quote';
  end if;

  new_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.quote_revoked_tokens (quote_id, token)
  values (p_quote_id, old_token)
  on conflict (token) do nothing;

  update public.quotes
  set public_token = new_token,
      status = 'draft',
      sent_at = null,
      reminded_at = null,
      first_viewed_at = null,
      last_viewed_at = null
  where id = p_quote_id;

  return new_token;
end;
$$;

revoke all on function public.rotate_quote_token(uuid) from public;
revoke all on function public.rotate_quote_token(uuid) from anon;

/* The owner's own session calls this through a Server Action. */
grant execute on function public.rotate_quote_token(uuid) to authenticated;

/* ============ a decided quote is frozen at the row level ============ */

/*
  Belt and braces around the same rule: once a client has approved or declined,
  the money and the contents are fixed. Status may still change (a quote can
  expire), and the decision columns are written by record_quote_decision, but
  the substance cannot be rewritten afterwards.
*/

create or replace function public.freeze_decided_quote()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('approved', 'declined')
     and new.status in ('approved', 'declined')
     and (
       new.client_id is distinct from old.client_id
       or new.lines_total is distinct from old.lines_total
       or new.vat_rate is distinct from old.vat_rate
       or new.prices_include_vat is distinct from old.prices_include_vat
       or new.notes is distinct from old.notes
       or new.valid_until is distinct from old.valid_until
       or new.public_token is distinct from old.public_token
     )
  then
    raise exception 'a quote that has been approved or declined cannot be edited';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_freeze_decided on public.quotes;
create trigger quotes_freeze_decided
  before update on public.quotes
  for each row execute function public.freeze_decided_quote();
