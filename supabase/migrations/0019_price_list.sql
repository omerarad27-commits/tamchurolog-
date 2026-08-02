/*
  The owner's own price list.

  A tradesperson does the same five jobs every week and retypes them into every
  quote. This is the list they build once: a name and a default price, picked in
  one tap while building a quote.

  Three things it deliberately is not:

  * It is not a product catalogue. No SKU, no stock, no supplier, no category.
    A line here is a sentence the owner would say on the phone, and a number.

  * It is not linked to the quotes it produced. Picking an item copies its name
    and price into a line item and the relationship ends there, so editing the
    price next month cannot rewrite a quote that was already sent, and deleting
    an item cannot orphan one. That is why there is no foreign key from
    quote_line_items back to this table, and there never should be.

  * It is not shared. Each business has its own, under the same RLS shape as
    clients: ownership is proved through businesses.owner_user_id, never taken
    from the request.

  Ordering is the owner's, not alphabetical. They know which three items they
  reach for daily, and that ordering is worth more than any sort we could
  invent. sort_order is a plain integer they rearrange with the arrows; ties
  break on created_at so a list that has never been rearranged still has a
  stable order.

  Block comments only, so no editor can autocorrect a double dash.
*/

create table if not exists public.price_list_items (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (btrim(name) <> '' and length(name) <= 120),
  unit_price  numeric(12, 2) not null default 0 check (unit_price >= 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists price_list_items_business_idx
  on public.price_list_items (business_id, sort_order, created_at);

/* ============================== RLS ============================== */

alter table public.price_list_items enable row level security;

drop policy if exists price_list_items_select_own on public.price_list_items;
create policy price_list_items_select_own on public.price_list_items
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = price_list_items.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists price_list_items_insert_own on public.price_list_items;
create policy price_list_items_insert_own on public.price_list_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = price_list_items.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists price_list_items_update_own on public.price_list_items;
create policy price_list_items_update_own on public.price_list_items
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = price_list_items.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = price_list_items.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists price_list_items_delete_own on public.price_list_items;
create policy price_list_items_delete_own on public.price_list_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = price_list_items.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ======================= reordering in one step ======================= */

/*
  Swapping two rows from the application would take a read, then two writes,
  with another tab's swap free to land in between and leave both items holding
  the same sort_order. One function, one statement, one row lock each.

  Ownership is re-proved inside rather than trusted from the caller: this runs
  as the invoker, so RLS still applies, and the explicit business check makes
  the intent readable at the call site.
*/

create or replace function public.swap_price_list_order(
  p_first  uuid,
  p_second uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  first_order  integer;
  second_order integer;
begin
  select sort_order into first_order
  from public.price_list_items where id = p_first for update;

  select sort_order into second_order
  from public.price_list_items where id = p_second for update;

  if first_order is null or second_order is null then
    return;
  end if;

  update public.price_list_items set sort_order = second_order where id = p_first;
  update public.price_list_items set sort_order = first_order where id = p_second;
end;
$$;
