/*
  A draft is not a document anybody may see.

  Until now the public token worked from the moment the quote row existed. A
  quote still being priced was fully readable at its link, approve button and
  all, so a client who had been sent an earlier link (or who guessed nothing at
  all, but simply kept an old tab open) could accept a price the owner had not
  finished writing.

  The page itself now refuses to render a draft, but the page is not the only
  door: both public entry points into the database are security-definer
  functions callable with only a token. They are the ones that have to say no.

    record_quote_decision  a draft can no longer be approved or declined
    record_quote_view      a draft records no view and no timestamps

  'draft' is therefore removed from the set of open statuses in the decision
  function. Nothing else about it changes; an already decided quote still
  returns 'unchanged' exactly as before, and so does a draft, which is the
  honest answer: nothing changed.

  The view function grows a status check rather than a filter on the select,
  so an unknown token and an unsent quote stay distinguishable in the code even
  though both do nothing.

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
    and status in ('sent', 'viewed')
  returning id into v_id;

  if v_id is null then
    /* Wrong token, an unsent draft, or a quote that was already decided. */
    return 'unchanged';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.record_quote_decision(text, text, text, text, text) from public;
revoke all on function public.record_quote_decision(text, text, text, text, text) from anon;
revoke all on function public.record_quote_decision(text, text, text, text, text) from authenticated;

create or replace function public.record_quote_view(
  p_token      text,
  p_ip_address text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote  uuid;
  target_status public.quote_status;
begin
  /* Resolve and lock in one step, so the token cannot rotate underneath us. */
  select id, status into target_quote, target_status
  from public.quotes
  where public_token = p_token
  for update;

  if target_quote is null then
    /* Retired or unknown token. Nothing to record. */
    return;
  end if;

  if target_status = 'draft' then
    /* Never sent. Whoever reached it is not the client reading their quote. */
    return;
  end if;

  insert into public.quote_view_events (quote_id, ip_address, user_agent)
  values (target_quote, p_ip_address, p_user_agent);

  update public.quotes
  set first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now(),
      status = case when status = 'sent' then 'viewed' else status end
  where id = target_quote;
end;
$$;

revoke all on function public.record_quote_view(text, text, text) from public;
revoke all on function public.record_quote_view(text, text, text) from anon;
revoke all on function public.record_quote_view(text, text, text) from authenticated;
