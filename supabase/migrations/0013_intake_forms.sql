/*
  Intake forms: a saved questionnaire, and one sent copy of it.

  Two tables, and the split between them is the whole design:

  intake_forms is the owner's library. It is edited freely.

  intake_requests is one questionnaire sent to one client. It carries its own
  COPY of the questions, taken at send time. Editing a saved form afterwards
  therefore cannot change a link already in a client's hands, and the answers
  stay attached to the questions that were actually asked. This is the same
  principle that freezes a sent quote.

  form_id is kept only so the owner can see which saved form a request came
  from. on delete set null means deleting a form never deletes the answers it
  produced.

  Questions and answers are jsonb rather than normalised tables because nothing
  ever queries inside them: they are rendered in order and read by a human.
  quote_line_items is normalised because its rows are summed and recalculated.
  There is no arithmetic here.

  Security: there is NO anon policy on either table, and none is added here.
  The public page is rendered on the server with the service_role key filtering
  on an exact public_token match, exactly as the quote page is, so the
  PostgREST API stays completely closed to anonymous callers.

  Block comments only, so no editor can autocorrect a double dash.
*/

/* ========================= intake_forms ========================= */

create table if not exists public.intake_forms (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  questions    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists intake_forms_business_id_idx
  on public.intake_forms (business_id, created_at desc);

alter table public.intake_forms enable row level security;

drop policy if exists intake_forms_select_own on public.intake_forms;
create policy intake_forms_select_own on public.intake_forms
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_insert_own on public.intake_forms;
create policy intake_forms_insert_own on public.intake_forms
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_update_own on public.intake_forms;
create policy intake_forms_update_own on public.intake_forms
  for update to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_forms_delete_own on public.intake_forms;
create policy intake_forms_delete_own on public.intake_forms
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_forms.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/* ======================== intake_requests ======================== */

create table if not exists public.intake_requests (
  id            uuid not null primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  form_id       uuid references public.intake_forms (id) on delete set null,
  client_id     uuid not null references public.clients (id) on delete cascade,
  form_name     text not null default '',
  questions     jsonb not null default '[]'::jsonb,
  answers       jsonb,
  public_token  text not null unique
                default replace(gen_random_uuid()::text, '-', ''),
  sent_at       timestamptz not null default now(),
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);

/*
  form_name is snapshotted alongside the questions for the same reason: the
  client hub says which questionnaire this was, and renaming the saved form
  must not rewrite history.
*/

create index if not exists intake_requests_client_id_idx
  on public.intake_requests (client_id, sent_at desc);

create index if not exists intake_requests_business_id_idx
  on public.intake_requests (business_id, sent_at desc);

create index if not exists intake_requests_public_token_idx
  on public.intake_requests (public_token);

alter table public.intake_requests enable row level security;

drop policy if exists intake_requests_select_own on public.intake_requests;
create policy intake_requests_select_own on public.intake_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_requests_insert_own on public.intake_requests;
create policy intake_requests_insert_own on public.intake_requests
  for insert to authenticated
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists intake_requests_delete_own on public.intake_requests;
create policy intake_requests_delete_own on public.intake_requests
  for delete to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = intake_requests.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

/*
  Deliberately no update policy for authenticated users. The only thing that
  ever updates this table is the submission, which is a client with no account
  and runs through a security definer function in the next migration. An owner
  who could update the row could edit their client's answers.
*/
