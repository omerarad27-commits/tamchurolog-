/*
  Phase 3: quotes and their line items.

  Design notes:

  * quote_number is per business and human readable (quote 7), not a global id.
    It is allocated from a counter on the businesses row, so the UPDATE takes a
    row lock and two quotes created at the same moment cannot collide.

  * public_token is what the Phase 4 public URL is built from. It must not be
    derivable from the row id. gen_random_uuid() is a cryptographically random
    v4 UUID; stripping the dashes gives 32 hex characters with 122 bits of
    entropy, which is far past guessable. This avoids depending on where
    pgcrypto happens to be installed.

  * subtotal and total are never written by the application. A trigger
    recalculates them from the line items, so the stored total can never drift
    away from the rows it is supposed to summarise.

  Block comments only, so no editor can autocorrect a double dash.
*/

/* ================= per-business quote numbering ================= */

alter table public.businesses
  add column if not exists next_quote_number integer not null default 1;

/* ========================= quote status ========================= */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum (
      'draft', 'sent', 'viewed', 'approved', 'declined', 'expired'
    );
  end if;
end
$$;

/* ============================ quotes ============================ */

create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete restrict,
  quote_number  integer not null,
  status        public.quote_status not null default 'draft',
  issued_at     timestamptz not null default now(),
  sent_at       timestamptz,
  valid_until   date,
  notes         text,
  subtotal      numeric(14, 2) not null default 0,
  tax_amount    numeric(14, 2),
  total         numeric(14, 2) not null default 0,
  public_token  text not null unique
                default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, quote_number)
);

create index if not exists quotes_business_id_idx on public.quotes (business_id);
create index if not exists quotes_client_id_idx on public.quotes (client_id);
create index if not exists quotes_public_token_idx on public.quotes (public_token);

/* ======================= quote_line_items ======================= */

create table if not exists public.quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  quantity    numeric(12, 2) not null default 1,
  unit_price  numeric(12, 2) not null default 0,
  line_total  numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order  integer not null default 0
);

create index if not exists quote_line_items_quote_id_idx
  on public.quote_line_items (quote_id, sort_order);

/* ==================== quote number allocation ==================== */

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allocated integer;
begin
  if new.quote_number is not null and new.quote_number > 0 then
    return new;
  end if;

  update public.businesses
  set next_quote_number = next_quote_number + 1
  where id = new.business_id
  returning next_quote_number - 1 into allocated;

  new.quote_number := coalesce(allocated, 1);
  return new;
end;
$$;

drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function public.assign_quote_number();

/* ===================== totals stay consistent ===================== */

create or replace function public.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote uuid := coalesce(new.quote_id, old.quote_id);
  new_subtotal numeric(14, 2);
begin
  select coalesce(sum(line_total), 0)
  into new_subtotal
  from public.quote_line_items
  where quote_id = target_quote;

  update public.quotes
  set subtotal = new_subtotal,
      total = new_subtotal + coalesce(tax_amount, 0),
      updated_at = now()
  where id = target_quote;

  return null;
end;
$$;

drop trigger if exists quote_line_items_recalculate on public.quote_line_items;
create trigger quote_line_items_recalculate
  after insert or update or delete on public.quote_line_items
  for each row execute function public.recalculate_quote_totals();

/* Keep updated_at honest on the quote itself. */

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

/* ============================== RLS ============================== */

alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

drop policy if exists quotes_select_own on public.quotes;
create policy quotes_select_own on public.quotes
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists quotes_insert_own on public.quotes;
create policy quotes_insert_own on public.quotes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id
        and b.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.clients c
      where c.id = quotes.client_id
        and c.business_id = quotes.business_id
    )
  );

drop policy if exists quotes_update_own on public.quotes;
create policy quotes_update_own on public.quotes
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists quotes_delete_own on public.quotes;
create policy quotes_delete_own on public.quotes
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = quotes.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* Line items inherit their tenancy from the quote they belong to. */

drop policy if exists quote_line_items_select_own on public.quote_line_items;
create policy quote_line_items_select_own on public.quote_line_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists quote_line_items_insert_own on public.quote_line_items;
create policy quote_line_items_insert_own on public.quote_line_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists quote_line_items_update_own on public.quote_line_items;
create policy quote_line_items_update_own on public.quote_line_items
  for update to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists quote_line_items_delete_own on public.quote_line_items;
create policy quote_line_items_delete_own on public.quote_line_items
  for delete to authenticated
  using (
    exists (
      select 1
      from public.quotes q
      join public.businesses b on b.id = q.business_id
      where q.id = quote_line_items.quote_id
        and b.owner_user_id = (select auth.uid())
    )
  );
