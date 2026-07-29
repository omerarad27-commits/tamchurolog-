/*
  Raises the logo bucket limit from 2MB to 3.5MB.

  This is a safety net, not the main fix. Logos are now shrunk in the browser
  before upload, so a file should arrive at well under 200KB. The higher ceiling
  only matters for the cases the browser path cannot handle: an SVG, or a
  browser too old for canvas encoding.

  Not raised further on purpose. Vercel rejects any request body over 4.5MB with
  a 413, so 3.5MB plus multipart overhead already sits at roughly 80 percent of
  a hard platform ceiling.

  Block comments only, so no editor can autocorrect a double dash.
*/

update storage.buckets
set file_size_limit = 3670016
where id = 'logos';
