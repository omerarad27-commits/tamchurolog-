/*
  Phase 1: multi-tenant foundation.

  Tenancy model: one auth user owns exactly one business (enforced by the unique
  constraint on owner_user_id). Every other table hangs off business_id.
  Row Level Security is the real boundary here; application-layer filtering is
  treated as a convenience, never as the security control.

  Block comments are used throughout instead of double-dash comments, because
  some editors autocorrect a double dash into an en dash and break the script.
*/

/* ========================= businesses ========================= */

create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null unique references auth.users (id) on delete cascade,
  name           text not null default '',
  phone          text,
  logo_url       text,
  default_terms  text,
  currency       text not null default 'ILS',
  created_at     timestamptz not null default now()
);

create index if not exists businesses_owner_user_id_idx
  on public.businesses (owner_user_id);

alter table public.businesses enable row level security;

/*
  auth.uid() is wrapped in a subselect so Postgres evaluates it once per query
  instead of once per row.
*/

drop policy if exists businesses_select_own on public.businesses;
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists businesses_insert_own on public.businesses;
create policy businesses_insert_own on public.businesses
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists businesses_update_own on public.businesses;
create policy businesses_update_own on public.businesses
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

/*
  Deliberately no delete policy: a business row is deleted only by cascade when
  the auth user is deleted.
*/

/* ========================= clients ========================= */

create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  full_name    text not null,
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists clients_business_id_idx
  on public.clients (business_id);

alter table public.clients enable row level security;

/*
  Ownership is proven by joining back to businesses rather than trusting the
  business_id supplied by the client.
*/

drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_own on public.clients
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = clients.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ============ auto-create a business row on signup ============ */

/*
  Done in the database rather than in application code so that a user can never
  exist without a business, even if the browser closes mid-signup.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.businesses (owner_user_id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), '')
  )
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* Backfill: give any user created before this migration a business row. */

insert into public.businesses (owner_user_id, name)
select u.id, ''
from auth.users u
where not exists (
  select 1 from public.businesses b where b.owner_user_id = u.id
);
