/**
 * Seeds quotes with varied ages and statuses into a real account, so the
 * follow-up flagging can be checked against known expectations.
 *
 *   npm run seed:demo -- you@example.com          # create
 *   npm run seed:demo -- you@example.com --clean  # remove everything it made
 *
 * Only ever touches clients whose name starts with the marker below, and the
 * quotes hanging off them. Your real data is not involved.
 *
 * Output is English on purpose — Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const MARKER = "[בדיקה]";
const FOLLOW_UP_AFTER_DAYS = 3;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const clean = args.includes("--clean");

if (!url || !serviceKey) {
  console.error("Missing env vars. Run via: npm run seed:demo -- you@example.com");
  process.exit(1);
}
if (!email) {
  console.error("Usage: npm run seed:demo -- you@example.com [--clean]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function findBusiness() {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) {
      const { data: business } = await admin
        .from("businesses")
        .select("id, name")
        .eq("owner_user_id", user.id)
        .single();
      return business;
    }
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/*
 * Each row states what the dashboard should do with it, so the expectation is
 * written down next to the data rather than worked out by hand afterwards.
 */
const SCENARIOS = [
  {
    client: `${MARKER} אבי דרפט`,
    status: "draft",
    sentDaysAgo: null,
    remindedDaysAgo: null,
    total: 1200,
    cold: false,
    why: "draft, never sent",
  },
  {
    client: `${MARKER} בני טרי`,
    status: "sent",
    sentDaysAgo: 1,
    remindedDaysAgo: null,
    total: 850,
    cold: false,
    why: "sent yesterday, still fresh",
  },
  {
    client: `${MARKER} גדי שקט`,
    status: "sent",
    sentDaysAgo: 5,
    remindedDaysAgo: null,
    total: 3400,
    cold: true,
    why: "sent 5 days ago, no answer",
  },
  {
    client: `${MARKER} דנה צפתה`,
    status: "viewed",
    sentDaysAgo: 10,
    remindedDaysAgo: null,
    total: 6200,
    cold: true,
    why: "opened it 10 days ago and went quiet",
  },
  {
    client: `${MARKER} הילה נוגחה`,
    status: "viewed",
    sentDaysAgo: 8,
    remindedDaysAgo: 1,
    total: 2100,
    cold: false,
    why: "old, but reminded yesterday so the clock restarted",
  },
  {
    client: `${MARKER} ורד אישרה`,
    status: "approved",
    sentDaysAgo: 6,
    remindedDaysAgo: null,
    total: 4500,
    cold: false,
    why: "already approved",
  },
  {
    client: `${MARKER} זהר דחתה`,
    status: "declined",
    sentDaysAgo: 9,
    remindedDaysAgo: null,
    total: 990,
    cold: false,
    why: "already declined",
  },
];

async function removeSeed(businessId) {
  const { data: clients } = await admin
    .from("clients")
    .select("id, full_name")
    .eq("business_id", businessId)
    .like("full_name", `${MARKER}%`);

  const ids = (clients ?? []).map((c) => c.id);
  if (ids.length === 0) {
    console.log("Nothing to clean.");
    return;
  }

  // Quotes reference clients with ON DELETE RESTRICT, so they go first.
  const { data: quotes } = await admin
    .from("quotes")
    .select("id")
    .in("client_id", ids);
  if ((quotes ?? []).length > 0) {
    await admin.from("quotes").delete().in("id", quotes.map((q) => q.id));
  }
  await admin.from("clients").delete().in("id", ids);

  console.log(`Removed ${ids.length} seeded clients and ${(quotes ?? []).length} quotes.`);
}

async function main() {
  const business = await findBusiness();
  if (!business) {
    console.error(`No business found for ${email}. Sign up in the app first.`);
    process.exit(1);
  }
  console.log(`Business: ${business.name || "(unnamed)"}\n`);

  await removeSeed(business.id);
  if (clean) return;

  let expectedCold = 0;

  for (const scenario of SCENARIOS) {
    const { data: client } = await admin
      .from("clients")
      .insert({
        business_id: business.id,
        full_name: scenario.client,
        phone: "+972541234567",
      })
      .select("id")
      .single();

    const { data: quote } = await admin
      .from("quotes")
      .insert({
        business_id: business.id,
        client_id: client.id,
        status: scenario.status,
        sent_at: scenario.sentDaysAgo === null ? null : daysAgo(scenario.sentDaysAgo),
        reminded_at:
          scenario.remindedDaysAgo === null ? null : daysAgo(scenario.remindedDaysAgo),
        decided_at:
          scenario.status === "approved" || scenario.status === "declined"
            ? daysAgo(2)
            : null,
        decision_signature_name:
          scenario.status === "approved" ? "לקוח בדיקה" : null,
        decision_reason:
          scenario.status === "declined" ? "המחיר גבוה מדי" : null,
        notes: "הצעה שנוצרה אוטומטית לצורכי בדיקה.",
      })
      .select("id, quote_number")
      .single();

    await admin.from("quote_line_items").insert({
      quote_id: quote.id,
      description: "עבודה לדוגמה",
      quantity: 1,
      unit_price: scenario.total,
      sort_order: 0,
    });

    if (scenario.cold) expectedCold += 1;

    console.log(
      `  #${quote.quote_number}  ${scenario.status.padEnd(9)} ` +
        `${scenario.cold ? "COLD  " : "      "} ${scenario.why}`,
    );
  }

  console.log(
    `\nThreshold is ${FOLLOW_UP_AFTER_DAYS} days.` +
      `\nThe dashboard should show exactly ${expectedCold} quotes under "needs follow-up".`,
  );
  console.log(`\nTo undo:  npm run seed:demo -- ${email} --clean`);
}

await main();
