/*
  Record a view against the token, not the quote id.

  Found by the verification suite rather than by reasoning about it.

  View tracking runs after the response is sent, so there is a short window
  between rendering the page and writing the event. If the owner edits the
  quote inside that window, the old token is retired and the timestamps are
  cleared, and then the late write lands and marks the brand new draft as
  viewed. The owner would see "viewed" on a version nobody has ever opened.

  Keying on the token closes it: the update only matches while that token is
  still the current one. A view arriving through a retired link touches
  nothing, which is also the correct answer on its own terms. Somebody looking
  at a cancelled quote has not looked at the quote that replaced it.

  Block comments only, so no editor can autocorrect a double dash.
*/

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
  target_quote uuid;
begin
  /* Resolve and lock in one step, so the token cannot rotate underneath us. */
  select id into target_quote
  from public.quotes
  where public_token = p_token
  for update;

  if target_quote is null then
    /* Retired or unknown token. Nothing to record. */
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

/* The previous signature took a uuid. Nothing should call it any more. */
drop function if exists public.record_quote_view(uuid, text, text);
