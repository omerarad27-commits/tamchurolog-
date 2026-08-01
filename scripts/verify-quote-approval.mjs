/**
 * The approval behaviour that already exists, asserted independently of the
 * notification being added on top of it.
 *
 * Run this BEFORE migration 0016 and confirm it passes. Then run it after.
 * A pass beforehand is what makes the second run meaningful.
 *
 * Run:  npm run verify:quote-approval
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const email = `approval-${Date.now()}@example.com`;
let userId = null;

async function run() {
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: "approval-check-password-123",
    email_confirm: true,
    user_metadata: { business_name: "בדיקת אישור" },
  });
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה לוי" })
    .select("id")
    .single();

  async function newQuote() {
    const { data: quote } = await admin
      .from("quotes")
      .insert({ business_id: biz.id, client_id: client.id, status: "sent" })
      .select("id, public_token, quote_number")
      .single();
    await admin.from("quote_line_items").insert({
      quote_id: quote.id,
      description: "עבודה",
      quantity: 1,
      unit_price: 100,
    });
    return quote;
  }

  /* ------------------------------------------------------------ approve */
  const q1 = await newQuote();
  const { data: outcome } = await admin.rpc("record_quote_decision", {
    p_token: q1.public_token,
    p_decision: "approved",
    p_signature_name: "  דנה לוי  ",
    p_ip: "203.0.113.9",
    p_reason: "",
  });
  check("approving returns ok", outcome === "ok", String(outcome));

  const { data: after } = await admin
    .from("quotes")
    .select("status, decided_at, decision_signature_name, decision_reason, total")
    .eq("id", q1.id)
    .single();

  check("the status became approved", after.status === "approved");
  check("decided_at was set", Boolean(after.decided_at));
  check(
    "the signature name was stored, trimmed",
    after.decision_signature_name === "דנה לוי",
    JSON.stringify(after.decision_signature_name),
  );
  check("no decline reason was smuggled in", after.decision_reason === null);
  check("the total the trigger computed survived", Number(after.total) === 100);

  /* ------------------------------------------------------- not decidable twice */
  const { data: replay } = await admin.rpc("record_quote_decision", {
    p_token: q1.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.9",
    p_reason: "changed my mind",
  });
  check("a second decision is refused", replay === "unchanged", String(replay));
  const { data: still } = await admin
    .from("quotes")
    .select("status, decision_reason")
    .eq("id", q1.id)
    .single();
  check("the first decision stands", still.status === "approved" && still.decision_reason === null);

  /* ------------------------------------------------------------- decline */
  const q2 = await newQuote();
  const { data: declined } = await admin.rpc("record_quote_decision", {
    p_token: q2.public_token,
    p_decision: "declined",
    p_signature_name: "",
    p_ip: "203.0.113.9",
    p_reason: "  יקר מדי  ",
  });
  check("declining returns ok", declined === "ok", String(declined));
  const { data: d } = await admin
    .from("quotes")
    .select("status, decision_reason, decision_signature_name")
    .eq("id", q2.id)
    .single();
  check("the status became declined", d.status === "declined");
  check("the reason was stored, trimmed", d.decision_reason === "יקר מדי");
  check("no signature name was smuggled in", d.decision_signature_name === null);

  /* --------------------------------------------------------- the guards */
  const q3 = await newQuote();
  const { data: noName } = await admin.rpc("record_quote_decision", {
    p_token: q3.public_token,
    p_decision: "approved",
    p_signature_name: "   ",
    p_ip: null,
    p_reason: "",
  });
  check("approving with no name returns missing_name", noName === "missing_name", String(noName));

  const { data: bogus } = await admin.rpc("record_quote_decision", {
    p_token: q3.public_token,
    p_decision: "maybe",
    p_signature_name: "x",
    p_ip: null,
    p_reason: "",
  });
  check("an unknown decision returns invalid", bogus === "invalid", String(bogus));

  const { data: unknownToken } = await admin.rpc("record_quote_decision", {
    p_token: "f".repeat(32),
    p_decision: "approved",
    p_signature_name: "דנה",
    p_ip: null,
    p_reason: "",
  });
  check("an unknown token returns unchanged", unknownToken === "unchanged", String(unknownToken));

  const { data: untouched } = await admin
    .from("quotes")
    .select("status")
    .eq("id", q3.id)
    .single();
  check("the guarded quote is still open", untouched.status === "sent");

  /* ------------- the notification, once 0016 has been applied ------------- */
  const { data: notes } = await admin
    .from("notifications")
    .select("kind, subject_name, quote_number, quote_id")
    .eq("business_id", biz.id);

  if (process.env.EXPECT_NOTIFICATION === "1") {
    check("approving raised exactly one notification", notes.length === 1, String(notes.length));
    check("it is a quote_approved", notes[0]?.kind === "quote_approved");
    check("it snapshotted the client's name", notes[0]?.subject_name === "דנה לוי");
    check("it snapshotted the quote number", notes[0]?.quote_number === q1.quote_number);
    check("it points at the quote", notes[0]?.quote_id === q1.id);
    check("declining raised nothing", notes.length === 1);
  } else {
    console.log("  [skip] notification checks (set EXPECT_NOTIFICATION=1 after 0016)");
  }
}

try {
  console.log("\nQuote approval behaviour\n");
  await run();
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  process.exit(1);
}
