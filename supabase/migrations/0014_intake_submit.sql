/*
  Recording a client's answers.

  One security definer function, keyed on the public token, called only from the
  server. Two things are enforced in SQL rather than in application code:

  1. submitted_at is null in the WHERE clause, so a double tap, a refresh, or a
     replayed request cannot overwrite answers that are already in. Checking
     this in TypeScript would leave a race between the read and the write.

  2. Nothing is returned but a status word. The function is reachable only
     through the server, but it still tells the caller nothing about a token it
     did not already hold.

  The answers themselves are validated in TypeScript against the questions
  snapshotted on the row, because the rules are about Hebrew text and option
  lists, not about integrity.

  Block comments only, so no editor can autocorrect a double dash.
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
  v_id uuid;
begin
  update public.intake_requests
  set answers = p_answers,
      submitted_at = now()
  where public_token = p_token
    and submitted_at is null
  returning id into v_id;

  if v_id is null then
    /* Either the token is wrong, or this was already answered. */
    return 'unchanged';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.submit_intake_request(text, jsonb) from public;
revoke all on function public.submit_intake_request(text, jsonb) from anon;
revoke all on function public.submit_intake_request(text, jsonb) from authenticated;
