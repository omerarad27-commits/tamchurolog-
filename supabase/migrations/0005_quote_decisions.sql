/*
  Phase 6: the client approves or declines from the public page.

  The decision is recorded by one security-definer function keyed on the public
  token, called only from the server. Two things are deliberately enforced in
  SQL rather than in application code:

  1. A quote can only be decided while it is still open (draft, sent, viewed).
     The WHERE clause makes "already decided" a no-op, so a double tap, a
     refresh, or a replayed request cannot overwrite an earlier decision or its
     timestamp. Checking this in TypeScript would leave a race between the read
     and the write.

  2. The signature name is stored only for an approval, and the reason only for
     a decline, so neither path can smuggle data into the other's field.

  On terminology: this is an "approval", never a "digital signature". Israel's
  Electronic Signature Law of 2001 defines "secured" and "certified" electronic
  signatures as specific things with requirements this does not meet. A typed
  name plus timestamp plus IP is admissible evidence of acceptance; calling it
  a digital signature would be overclaiming.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.quotes
  add column if not exists decision_signature_name text,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_ip text,
  add column if not exists decision_reason text;

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
  v_id uuid;
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
  returning id into v_id;

  if v_id is null then
    /* Either the token is wrong, or this quote was already decided. */
    return 'unchanged';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.record_quote_decision(text, text, text, text, text) from public;
revoke all on function public.record_quote_decision(text, text, text, text, text) from anon;
revoke all on function public.record_quote_decision(text, text, text, text, text) from authenticated;
