/*
  Optional VAT per quote.

  The rate is stored on the quote rather than read from a constant at display
  time. A quote sent today at 18 percent must still read 18 percent in two
  years if the rate changes, because it is a record of what was offered, not a
  live calculation.

  Money is still never written by the application. Responsibility is split:

    * the line items trigger maintains subtotal and nothing else
    * a trigger on quotes derives tax_amount and total from subtotal and
      vat_rate, on every insert and every update

  So changing the VAT flag, or editing a line item, both end up in the same
  single place that decides what the totals are.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.quotes
  add column if not exists vat_rate numeric(5, 4) not null default 0;

/* ============ one place decides tax_amount and total ============ */

create or replace function public.apply_quote_money()
returns trigger
language plpgsql
as $$
begin
  new.tax_amount := round(new.subtotal * coalesce(new.vat_rate, 0), 2);
  new.total := new.subtotal + new.tax_amount;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quotes_touch_updated_at on public.quotes;
drop trigger if exists quotes_apply_money on public.quotes;
create trigger quotes_apply_money
  before insert or update on public.quotes
  for each row execute function public.apply_quote_money();

/* touch_updated_at is now folded into apply_quote_money. */
drop function if exists public.touch_updated_at();

/* ========== line items maintain subtotal, and only that ========== */

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

  /* The BEFORE UPDATE trigger on quotes turns this into tax_amount and total. */
  update public.quotes
  set subtotal = new_subtotal
  where id = target_quote;

  return null;
end;
$$;

/* Backfill: existing quotes carry no VAT, so their totals are already correct. */
update public.quotes
set subtotal = subtotal
where vat_rate = 0;
