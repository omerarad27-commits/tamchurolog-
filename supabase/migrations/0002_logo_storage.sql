/*
  Phase 2: storage for business logos.

  The bucket is public on purpose. A logo is shown on the public quote page that
  clients open without logging in, so read access has to be open anyway, and a
  public bucket avoids signing a URL on every render.

  Writes are locked down: an owner may only touch files under a folder named
  after their own business id. Path convention is  <business_id>/logo.<ext>

  Block comments only, so no editor can autocorrect a double dash.
*/

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

/* Anyone may read; that is what "public bucket" means. */

drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

/*
  For writes, the first path segment must be a business id owned by the caller.
  storage.foldername(name) splits the object path into its segments.
*/

drop policy if exists logos_owner_insert on storage.objects;
create policy logos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists logos_owner_update on storage.objects;
create policy logos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists logos_owner_delete on storage.objects;
create policy logos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );
