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
