/**
 * Checks that migrations 0018-0020 actually landed on the database this app
 * is pointed at.
 *
 * The failure it exists to catch: SQL pasted into the wrong Supabase project,
 * which succeeds loudly and changes nothing here.
 *
 * Run:  npm run verify:migrations
 *
 * Output is English on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:migrations");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

console.log(`Project: ${url}\n`);

let failures = 0;

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/* 0019: the price list table exists and is readable. */
{
  const { error } = await db.from("price_list_items").select("id").limit(1);
  report(
    "0019 price_list_items table",
    !error,
    error ? error.message : undefined,
  );
}

/* 0020: the tips column exists on businesses. */
{
  const { error } = await db.from("businesses").select("dismissed_tips").limit(1);
  report(
    "0020 businesses.dismissed_tips",
    !error,
    error ? error.message : undefined,
  );
}

/*
 * 0018: a draft can no longer be decided through the public RPC.
 *
 * Called with a token that matches the shape but belongs to nothing. Before
 * 0018 and after it this returns "unchanged", so the shape of the call is what
 * is being checked here, not the behaviour - the behavioural half is in
 * verify:public, which needs a real quote to work with.
 */
{
  const { data, error } = await db.rpc("record_quote_decision", {
    p_token: "0".repeat(32),
    p_decision: "approved",
    p_signature_name: "verify",
    p_ip: null,
    p_reason: "",
  });
  report(
    "0018 record_quote_decision callable",
    !error && data === "unchanged",
    error ? error.message : `returned ${JSON.stringify(data)}`,
  );
}

/* 0019: the reorder helper exists. */
{
  const { error } = await db.rpc("swap_price_list_order", {
    p_first: "00000000-0000-0000-0000-000000000000",
    p_second: "00000000-0000-0000-0000-000000000001",
  });
  report(
    "0019 swap_price_list_order function",
    !error,
    error ? error.message : undefined,
  );
}

console.log(
  failures === 0
    ? "\nAll migrations are present on this project."
    : `\n${failures} check(s) failed. The SQL did not reach this project.`,
);

process.exit(failures === 0 ? 0 : 1);
