/*
  Tell the owner when a quote is declined, too.

  0016 raised a notification for an approval and deliberately raised nothing for
  a decline, on the reasoning that a notification for every outcome trains people
  to ignore all of them. In practice that reads as a broken feature: the owner
  sees some decisions appear in the bell and others never do, and cannot tell
  which. A decision is a decision. Both now raise one.

  Two changes and nothing else:

    1. the kind check constraint learns 'quote_declined'
    2. the insert in record_quote_decision moves out of the approved-only branch

  Everything else about the function is unchanged: same signature, same four
  return values, same guards, same WHERE clause that makes a second decision a
  no-op. The insert still sits inside the same function as the update, so there
  is no state where a quote is decided and the owner was never told.

  The check constraint is replaced rather than edited in 0015: a migration that
  has already run is a record of what happened.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('intake_submitted', 'quote_approved', 'quote_declined'));

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

  select full_name into v_name from public.clients where id = v_client;

  /*
    One row per decision. The kind carries which way it went, so the wording
    stays in TypeScript where changing it costs nothing, exactly as 0015 set up.
  */
  insert into public.notifications
    (business_id, kind, subject_name, quote_number, quote_id)
  values
    (v_business,
     case when p_decision = 'approved' then 'quote_approved'
          else 'quote_declined' end,
     v_name, v_number, v_id);

  return 'ok';
end;
$$;

revoke all on function public.record_quote_decision(text, text, text, text, text) from public;
revoke all on function public.record_quote_decision(text, text, text, text, text) from anon;
revoke all on function public.record_quote_decision(text, text, text, text, text) from authenticated;
