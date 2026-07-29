/*
  Phase 7: follow-up nudges.

  One column beyond the original plan: reminded_at.

  Reason: without it, the follow-up list can never clear. The owner taps
  "send reminder", WhatsApp opens, and the quote stays in the needs-attention
  section forever with no way to tell an unchased quote from one chased twice
  this morning. A follow-up list that never shrinks stops being read, which
  defeats the point of building it.

  With reminded_at, the clock restarts from the last contact instead of from
  sent_at, so a quote reappears only once it has gone quiet again.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.quotes
  add column if not exists reminded_at timestamptz;

/*
  Partial index for the dashboard query: only quotes still awaiting a decision
  are ever scanned for follow-up.
*/
create index if not exists quotes_awaiting_decision_idx
  on public.quotes (business_id, sent_at)
  where status in ('sent', 'viewed');
