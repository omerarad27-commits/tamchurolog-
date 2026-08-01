/*
  A subject line for a quote: what the work actually is.

  Until now a client receiving three quotes from the same tradesperson could
  only tell them apart by number, which is a filing detail and means nothing to
  them. "Bathroom renovation" does.

  Nullable, with no default. Every quote written before this migration is a
  finished document and must not acquire a heading nobody wrote; the pages read
  a missing title as "no subject" and fall back to the wording they use today.

  Length is capped in the database as well as in the form. This is a heading
  rendered in one line on a phone, and the constraint is what stops a paragraph
  pasted into the field from reaching the client's screen.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.quotes
  add column if not exists title text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_title_length'
  ) then
    alter table public.quotes
      add constraint quotes_title_length
      check (title is null or char_length(title) <= 80);
  end if;
end
$$;

/*
  No RLS change is needed: the existing policies on public.quotes are row
  level, not column level, so the new column inherits them. The public page
  reads through the service role and names its columns one by one, so the title
  reaches a client only where it is asked for explicitly.
*/
