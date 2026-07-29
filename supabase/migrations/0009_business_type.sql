/*
  Business type, chosen at signup.

  This is not a preference, it is a fact about the business that determines
  what it is allowed to charge:

    exempt   (osek patur)     may not charge VAT at all
    licensed (osek murshe)    charges VAT
    company  (chevra be am)   charges VAT

  It drives the default position of the VAT switch on a new quote. Getting this
  wrong in the other direction matters: an exempt business that has to remember
  to turn VAT off on every quote will eventually forget, and will have charged
  a client VAT it is not entitled to collect.

  Defaults to licensed, which is what most tradespeople are, and what every
  business created before this migration was implicitly treated as.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.businesses
  add column if not exists business_type text not null default 'licensed';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'businesses_business_type_check'
  ) then
    alter table public.businesses
      add constraint businesses_business_type_check
      check (business_type in ('exempt', 'licensed', 'company'));
  end if;
end
$$;

/*
  The signup trigger now carries the choice through from the signup form.
  An unrecognised or missing value falls back to licensed rather than failing
  the signup, since a wrong default is recoverable in settings and a failed
  registration is not.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_type text;
begin
  chosen_type := new.raw_user_meta_data ->> 'business_type';

  if chosen_type is null or chosen_type not in ('exempt', 'licensed', 'company') then
    chosen_type := 'licensed';
  end if;

  insert into public.businesses (owner_user_id, name, business_type)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), ''),
    chosen_type
  )
  on conflict (owner_user_id) do nothing;

  return new;
end;
$$;
