/**
 * End-to-end proof for the public quote page and view tracking.
 *
 * Seeds a real quote, then drives the running app over HTTP exactly as a
 * client's phone would, and checks what actually landed in the database.
 *
 * Requires the dev server (or any deployment) to be reachable.
 *   npm run dev            # in another terminal
 *   npm run verify:public
 *
 * Output is English on purpose — Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:public");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const WHATSAPP_UA = "WhatsApp/2.23.20.0 A";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const stamp = Date.now();
const owner = { email: `public-check-${stamp}@example.com`, id: null };
let quoteId = null;
let token = null;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: owner.email,
    password: "public-check-password-123",
    email_confirm: true,
    user_metadata: { business_name: "Public Check Plumbing" },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  owner.id = created.user.id;

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", owner.id)
    .single();

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: business.id, full_name: "Public Check Client", phone: "+972541234567" })
    .select("id")
    .single();

  const { data: quote, error: quoteError } = await admin
    .from("quotes")
    .insert({
      business_id: business.id,
      client_id: client.id,
      status: "sent",
      sent_at: new Date().toISOString(),
      notes: "Terms go here.",
    })
    .select("id, public_token, status")
    .single();
  if (quoteError) throw new Error(`quote insert failed: ${quoteError.message}`);

  quoteId = quote.id;
  token = quote.public_token;

  await admin.from("quote_line_items").insert([
    { quote_id: quoteId, description: "Labour", quantity: 2, unit_price: 150.5, sort_order: 0 },
    { quote_id: quoteId, description: "Parts", quantity: 1, unit_price: 99.99, sort_order: 1 },
  ]);
}

async function visit(userAgent, path = `/q/${token}`) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "user-agent": userAgent },
    redirect: "manual",
  });
  const body = response.status === 200 ? await response.text() : "";
  return { status: response.status, body };
}

async function readQuote() {
  const { data } = await admin
    .from("quotes")
    .select("status, first_viewed_at, last_viewed_at")
    .eq("id", quoteId)
    .single();
  return data;
}

async function countEvents() {
  const { count } = await admin
    .from("quote_view_events")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quoteId);
  return count ?? 0;
}

/** after() finishes off the response, so give the write a moment to land. */
async function waitForEvents(expected, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let seen = await countEvents();
  while (seen < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    seen = await countEvents();
  }
  return seen;
}

async function cleanup() {
  if (owner.id) await admin.auth.admin.deleteUser(owner.id);
}

async function main() {
  console.log(`\nTarget: ${baseUrl}`);
  console.log("Seeding a quote in status 'sent'...");
  await seed();
  console.log(`  token: ${token}`);

  console.log("\n1. The page itself");
  const first = await visit(BROWSER_UA);
  check("public link returns 200 without any login", first.status === 200,
    `status ${first.status}`);
  check("renders RTL Hebrew", first.body.includes('dir="rtl"') && first.body.includes("הצעת מחיר"));
  check("shows the business name", first.body.includes("Public Check Plumbing"));
  check("shows the client name", first.body.includes("Public Check Client"));
  check("shows the correct total (2 x 150.50 + 99.99 = 400.99)",
    first.body.includes("400.99"));
  check("is marked noindex so quotes never reach a search engine",
    first.body.includes("noindex"));

  console.log("\n2. View tracking");
  const afterFirst = await waitForEvents(1);
  const q1 = await readQuote();
  check("one view event was recorded", afterFirst === 1, `events: ${afterFirst}`);
  check("status flipped from 'sent' to 'viewed'", q1.status === "viewed", q1.status);
  check("first_viewed_at was set", Boolean(q1.first_viewed_at));
  check("last_viewed_at was set", Boolean(q1.last_viewed_at));

  await visit(BROWSER_UA);
  const afterSecond = await waitForEvents(2);
  const q2 = await readQuote();
  check("a second visit logs a second event", afterSecond === 2, `events: ${afterSecond}`);
  check("first_viewed_at did NOT move on the second visit",
    q1.first_viewed_at === q2.first_viewed_at);
  check("last_viewed_at DID move on the second visit",
    new Date(q2.last_viewed_at) > new Date(q1.last_viewed_at));

  console.log("\n3. WhatsApp link preview must not count as a view");
  const preview = await visit(WHATSAPP_UA);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const afterBot = await countEvents();
  const q3 = await readQuote();
  check("crawler still receives the page so the preview card renders",
    preview.status === 200, `status ${preview.status}`);
  check("crawler visit did NOT create a view event", afterBot === 2, `events: ${afterBot}`);
  check("crawler visit did NOT move last_viewed_at",
    q2.last_viewed_at === q3.last_viewed_at);

  console.log("\n4. A decided quote is never dragged backwards");
  await admin.from("quotes").update({ status: "approved" }).eq("id", quoteId);
  await visit(BROWSER_UA);
  await waitForEvents(3);
  const q4 = await readQuote();
  check("revisiting an approved quote leaves it approved",
    q4.status === "approved", q4.status);
  check("the visit is still logged as an event",
    (await countEvents()) === 3, `events: ${await countEvents()}`);

  console.log("\n5. Nothing is reachable without the exact token");
  const wrongToken = await visit(BROWSER_UA, `/q/${"a".repeat(32)}`);
  check("a random 32-char token returns 404", wrongToken.status === 404,
    `status ${wrongToken.status}`);

  const idAsToken = await visit(BROWSER_UA, `/q/${quoteId.replace(/-/g, "")}`);
  check("the row id used as a token returns 404 (token is not derived from it)",
    idAsToken.status === 404, `status ${idAsToken.status}`);

  const truncated = await visit(BROWSER_UA, `/q/${token.slice(0, 20)}`);
  check("a truncated token returns 404 (no prefix matching)",
    truncated.status === 404, `status ${truncated.status}`);

  console.log("\n6. The REST API stays closed to the public");
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonQuotes = await anonClient.from("quotes").select("id, public_token");
  check("anonymous callers cannot list quotes",
    (anonQuotes.data ?? []).length === 0,
    `rows: ${(anonQuotes.data ?? []).length}`);

  const anonByToken = await anonClient
    .from("quotes")
    .select("id")
    .eq("public_token", token);
  check("anonymous callers cannot fetch a quote even WITH the token",
    (anonByToken.data ?? []).length === 0,
    `rows: ${(anonByToken.data ?? []).length}`);

  const anonEvents = await anonClient.from("quote_view_events").select("id");
  check("anonymous callers cannot read view events",
    (anonEvents.data ?? []).length === 0,
    `rows: ${(anonEvents.data ?? []).length}`);

  console.log("\n7. Approve and decline");

  /* Fresh quote so the earlier one being approved does not interfere. */
  const { data: openQuote } = await admin
    .from("quotes")
    .select("business_id, client_id")
    .eq("id", quoteId)
    .single();

  const makeOpenQuote = async () => {
    const { data } = await admin
      .from("quotes")
      .insert({
        business_id: openQuote.business_id,
        client_id: openQuote.client_id,
        status: "viewed",
      })
      .select("id, public_token")
      .single();
    await admin.from("quote_line_items").insert({
      quote_id: data.id, description: "Work", quantity: 1, unit_price: 500, sort_order: 0,
    });
    return data;
  };

  const toApprove = await makeOpenQuote();

  const beforeDecision = await visit(BROWSER_UA, `/q/${toApprove.public_token}`);
  check("an open quote shows the approve and decline buttons",
    beforeDecision.body.includes("אישור ההצעה") &&
      beforeDecision.body.includes("לא מעוניין"));
  check("the disclaimer about not being a party to the deal is shown",
    beforeDecision.body.includes("אינו צד להתקשרות"));

  const approveResult = await admin.rpc("record_quote_decision", {
    p_token: toApprove.public_token,
    p_decision: "approved",
    p_signature_name: "  Dana Levi  ",
    p_ip: "203.0.113.9",
    p_reason: "",
  });
  check("approving an open quote succeeds", approveResult.data === "ok",
    String(approveResult.data ?? approveResult.error?.message));

  const { data: approved } = await admin
    .from("quotes")
    .select("status, decision_signature_name, decided_at, decision_ip, decision_reason")
    .eq("id", toApprove.id)
    .single();
  check("status is approved", approved.status === "approved", approved.status);
  check("the typed name is stored, trimmed",
    approved.decision_signature_name === "Dana Levi",
    JSON.stringify(approved.decision_signature_name));
  check("decided_at and the IP are captured",
    Boolean(approved.decided_at) && approved.decision_ip === "203.0.113.9");
  check("no decline reason leaked into an approval",
    approved.decision_reason === null);

  const afterDecision = await visit(BROWSER_UA, `/q/${toApprove.public_token}`);
  check("the action buttons are gone after approval",
    !afterDecision.body.includes("לא מעוניין"));
  check("the page shows the approval and who gave it",
    afterDecision.body.includes("ההצעה אושרה") &&
      afterDecision.body.includes("Dana Levi"));

  /* The important one: a replay must not overwrite the first decision. */
  const replay = await admin.rpc("record_quote_decision", {
    p_token: toApprove.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.99",
    p_reason: "changed my mind",
  });
  const { data: afterReplay } = await admin
    .from("quotes")
    .select("status, decided_at, decision_signature_name")
    .eq("id", toApprove.id)
    .single();
  check("a second decision on the same quote is refused",
    replay.data === "unchanged", String(replay.data));
  check("the original decision is untouched by the replay",
    afterReplay.status === "approved" &&
      afterReplay.decided_at === approved.decided_at &&
      afterReplay.decision_signature_name === "Dana Levi");

  /* Decline path, on its own quote. */
  const toDecline = await makeOpenQuote();
  const declineResult = await admin.rpc("record_quote_decision", {
    p_token: toDecline.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.10",
    p_reason: "המחיר גבוה מדי",
  });
  const { data: declined } = await admin
    .from("quotes")
    .select("status, decision_reason, decision_signature_name")
    .eq("id", toDecline.id)
    .single();
  check("declining works", declineResult.data === "ok", String(declineResult.data));
  check("the reason is stored", declined.decision_reason === "המחיר גבוה מדי",
    String(declined.decision_reason));
  check("no signature name is stored for a decline",
    declined.decision_signature_name === null);

  /* Input guards. */
  const noName = await makeOpenQuote();
  const missingName = await admin.rpc("record_quote_decision", {
    p_token: noName.public_token,
    p_decision: "approved",
    p_signature_name: "   ",
    p_ip: null,
    p_reason: "",
  });
  check("approving with a blank name is refused",
    missingName.data === "missing_name", String(missingName.data));

  const bogus = await admin.rpc("record_quote_decision", {
    p_token: noName.public_token,
    p_decision: "cancelled",
    p_signature_name: "X",
    p_ip: null,
    p_reason: "",
  });
  check("an unknown decision value is refused", bogus.data === "invalid",
    String(bogus.data));

  const wrongTokenDecision = await admin.rpc("record_quote_decision", {
    p_token: "b".repeat(32),
    p_decision: "approved",
    p_signature_name: "Someone",
    p_ip: null,
    p_reason: "",
  });
  check("a decision on an unknown token changes nothing",
    wrongTokenDecision.data === "unchanged", String(wrongTokenDecision.data));

  /* And the function itself must not be reachable without the service key. */
  const anonDecision = await anonClient.rpc("record_quote_decision", {
    p_token: noName.public_token,
    p_decision: "approved",
    p_signature_name: "Attacker",
    p_ip: null,
    p_reason: "",
  });
  check("anonymous callers cannot invoke the decision function directly",
    Boolean(anonDecision.error),
    anonDecision.error ? anonDecision.error.code : "call unexpectedly succeeded");
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  console.error(`\nERROR: ${error.message}`);
  exitCode = 1;
} finally {
  await cleanup();
  console.log("\nCleaned up the test owner and everything under it.");
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log("Failed checks:");
  for (const f of failed) console.log(`  - ${f.name}`);
  exitCode = 1;
}
process.exit(exitCode);
