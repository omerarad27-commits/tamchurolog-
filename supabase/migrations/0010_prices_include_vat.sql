/*
  Let the owner enter prices that already include VAT.

  Two ways of quoting the same job:

    exclusive  enter 1000, client pays 1180
    inclusive  enter 1180, client pays 1180

  Many tradespeople think in the final number they say out loud on the phone,
  so forcing them to divide by 1.18 in their head invites arithmetic errors on
  a document that becomes a contract.

  Structure: a new column lines_total holds the raw sum of the line items,
  which is what the owner actually typed. subtotal, tax_amount and total are
  then all derived from it. That keeps their meaning fixed no matter which mode
  was used:

    lines_total  what was entered
    subtotal     always the amount before VAT
    tax_amount   always the VAT itself
    total        always what the client pays

  Because every display already reads those three, none of them needs to know
  which mode produced the numbers.

  Rounding: in inclusive mode the VAT is derived by subtraction rather than
  multiplication, so subtotal plus tax_amount always equals total exactly. A
  one agora discrepancy on a quote is the kind of thing a client notices.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.quotes
  add column if not exists lines_total numeric(14, 2) not null default 0,
  add column if not exists prices_include_vat boolean not null default false;

/* Existing quotes were all entered exclusive of VAT. */
update public.quotes
set lines_total = subtotal
where lines_total = 0 and subtotal <> 0;

/* ============ line items maintain lines_total, and only that ============ */

create or replace function public.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote uuid := coalesce(new.quote_id, old.quote_id);
  new_lines_total numeric(14, 2);
begin
  select coalesce(sum(line_total), 0)
  into new_lines_total
  from public.quote_line_items
  where quote_id = target_quote;

  /* The BEFORE UPDATE trigger on quotes splits this into the three figures. */
  update public.quotes
  set lines_total = new_lines_total
  where id = target_quote;

  return null;
end;
$$;

/* ================= one place derives the three figures ================= */

create or replace function public.apply_quote_money()
returns trigger
language plpgsql
as $$
declare
  rate numeric := coalesce(new.vat_rate, 0);
begin
  if rate = 0 then
    new.subtotal := new.lines_total;
    new.tax_amount := 0;
    new.total := new.lines_total;

  elsif new.prices_include_vat then
    /* Entered gross. Derive the net, then take VAT as the remainder so the
       three numbers always reconcile to the agora. */
    new.total := new.lines_total;
    new.subtotal := round(new.lines_total / (1 + rate), 2);
    new.tax_amount := new.total - new.subtotal;

  else
    /* Entered net. VAT goes on top. */
    new.subtotal := new.lines_total;
    new.tax_amount := round(new.lines_total * rate, 2);
    new.total := new.subtotal + new.tax_amount;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quotes_apply_money on public.quotes;
create trigger quotes_apply_money
  before insert or update on public.quotes
  for each row execute function public.apply_quote_money();

/* Recompute every existing quote through the new logic. */
update public.quotes set lines_total = lines_total;
