/*
  Which in-app tips this owner has already dismissed.

  The rule the product asks for is "once, and never again", and localStorage
  cannot keep that promise: it is per browser and per device, so the owner who
  closes a tip on their phone meets it again on the laptop, which reads as the
  app not listening. A column on the business is the only place that survives
  both.

  A text array rather than a boolean per tip. Tips are written and retired far
  more often than the schema should change, and an unknown string in here is
  simply a tip that no longer exists, which needs no migration to clean up.

  Not an enum for the same reason: adding a value to a Postgres enum inside a
  transaction has restrictions, and none of that cost buys anything here. The
  application holds the list of tip ids it knows about.

  Block comments only, so no editor can autocorrect a double dash.
*/

alter table public.businesses
  add column if not exists dismissed_tips text[] not null default '{}';
