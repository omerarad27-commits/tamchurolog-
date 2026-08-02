/**
 * Loads every authenticated screen, signed in, with real data behind it.
 *
 * This exists because of a bug it would have caught and nothing else did.
 * `toQuoteListRow` was exported from a module carrying "use client", which
 * makes it a client reference; the server page imported it and called it, and
 * the quotes screen threw on every render. TypeScript does not model the
 * server/client boundary, eslint did not object, and `next build` compiled it
 * happily - the failure only exists at render time, with a session and rows to
 * map over. Unauthenticated smoke tests all passed, because every one of them
 * was redirected to the login page before a single quote was rendered.
 *
 * So the rule here: sign in, then open each screen, and fail on anything the
 * error boundary caught or the console reported.
 *
 * Run:  npm run verify:screens
 *       npm run verify:screens -- --url https://your-app.vercel.app
 *
 * Against a deployed URL it seeds through the same Supabase project the site
 * uses, so the two must match - see the note printed at startup.
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3000";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:screens");
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const email = `screencheck-${Date.now()}@example.com`;
const PASSWORD = "screen-check-password-123";
let userId = null;
const seeded = {};

/*
 * Enough data that every branch of every screen has something to render:
 * an itemized quote, a flat one, a decided one, a price list, and a client.
 * A screen that only ever renders its empty state proves nothing.
 */
async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת מסכים", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses").select("id").eq("owner_user_id", userId).single();
  seeded.businessId = biz.id;

  await admin
    .from("businesses")
    .update({ phone: "0541234567", default_terms: "תנאי תשלום: שוטף + 30." })
    .eq("id", biz.id);

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "אורי כהן", phone: "0541234567" })
    .select("id").single();
  seeded.clientId = client.id;
  seeded.clientName = "אורי כהן";

  /* An ordinary itemized quote. */
  const { data: itemized } = await admin
    .from("quotes")
    .insert({ business_id: biz.id, client_id: client.id, title: "שיפוץ אמבטיה", vat_rate: 0.18 })
    .select("id").single();
  await admin.from("quote_line_items").insert([
    { quote_id: itemized.id, description: "פירוק וריצוף", quantity: 1, unit_price: 4200, sort_order: 0 },
    { quote_id: itemized.id, description: "שעת עבודה", quantity: 6, unit_price: 250, sort_order: 1 },
  ]);
  seeded.itemizedQuoteId = itemized.id;

  /* A flat quote: a subject and a figure, no line items at all. */
  const { data: flat } = await admin
    .from("quotes")
    .insert({
      business_id: biz.id,
      client_id: client.id,
      title: "תיקון נזילה במקלחת",
      vat_rate: 0.18,
      prices_include_vat: true,
      lines_total: 400,
    })
    .select("id").single();
  seeded.flatQuoteId = flat.id;

  /* A decided quote, which is where the duplicate tip lives. */
  const { data: approved } = await admin
    .from("quotes")
    .insert({
      business_id: biz.id,
      client_id: client.id,
      title: "החלפת ברז",
      status: "approved",
      sent_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
      decision_signature_name: "אורי כהן",
      lines_total: 300,
    })
    .select("id").single();
  seeded.approvedQuoteId = approved.id;

  await admin.from("price_list_items").insert([
    { business_id: biz.id, name: "פתיחת סתימה במטבח", unit_price: 450, sort_order: 1 },
    { business_id: biz.id, name: "שעת עבודה", unit_price: 250, sort_order: 2 },
  ]);
}

async function run() {
  await seed();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  /*
   * Anything React logged, and anything the app failed to fetch.
   *
   * A server component that throws is caught by error.tsx and answers 200 with
   * an apology, so the status code alone says nothing. The console does.
   */
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err.message)));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  /*
   * Every authenticated screen, with something it must have rendered.
   *
   * The expectation is deliberately a piece of the seeded data or a control
   * unique to that screen, not a heading: a page that threw still renders its
   * heading through the layout.
   */
  const screens = [
    { path: "/dashboard", expect: "אורי כהן", name: "quotes list" },
    { path: "/dashboard?filter=approved", expect: "החלפת ברז", name: "quotes list, filtered" },
    { path: "/dashboard/clients", expect: "אורי כהן", name: "clients" },
    { path: `/dashboard/clients/${seeded.clientId}`, expect: "אורי כהן", name: "client card" },
    { path: "/dashboard/pricelist", expect: "פתיחת סתימה במטבח", name: "price list" },
    { path: "/dashboard/quotes/quick", expect: "שליחה בוואטסאפ", name: "quick quote" },
    { path: "/dashboard/quotes/new", expect: "בחירה מהמחירון", name: "new quote" },
    {
      /*
       * The duplicate's contents land in form fields, whose values innerText
       * cannot see, so the assertion is the heading the route switches to.
       * The fields themselves are checked separately below.
       */
      path: `/dashboard/quotes/new?from=${seeded.itemizedQuoteId}`,
      expect: "שכפול הצעה",
      name: "duplicate a quote",
    },
    {
      path: `/dashboard/quotes/${seeded.itemizedQuoteId}`,
      expect: "פירוק וריצוף",
      name: "quote, itemized",
    },
    {
      path: `/dashboard/quotes/${seeded.flatQuoteId}`,
      expect: "תיקון נזילה במקלחת",
      name: "quote, flat",
    },
    {
      path: `/dashboard/quotes/${seeded.approvedQuoteId}`,
      expect: "שכפול ההצעה",
      name: "quote, approved",
    },
    {
      path: `/dashboard/quotes/${seeded.itemizedQuoteId}/edit`,
      expect: "בחירה מהמחירון",
      name: "edit quote",
    },
    { path: "/dashboard/stats", expect: "סיכום", name: "stats" },
    { path: "/dashboard/settings", expect: "הגדרות", name: "settings" },
    { path: "/dashboard/forms", expect: "שאלונים", name: "forms" },
    { path: "/dashboard/notifications", expect: "התראות", name: "notifications" },
  ];

  for (const screen of screens) {
    consoleErrors.length = 0;
    await page.goto(`${BASE}${screen.path}`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();

    /* error.tsx renders this. It is the app admitting a render threw. */
    const crashed =
      body.includes("משהו השתבש") || body.includes("אירעה שגיאה בלתי צפויה");

    check(
      `${screen.name} renders`,
      !crashed && body.includes(screen.expect) && consoleErrors.length === 0,
      crashed
        ? "error boundary"
        : !body.includes(screen.expect)
          ? `missing "${screen.expect}"`
          : consoleErrors.length > 0
            ? consoleErrors[0].slice(0, 160)
            : "",
    );
  }

  /*
   * What the duplicate actually carried over, read from the fields rather than
   * from the text of the page.
   *
   * Three separate promises: the source's line items, its subject, and a
   * validity date recomputed from today rather than inherited from a quote that
   * may have expired months ago.
   */
  await page.goto(`${BASE}/dashboard/quotes/new?from=${seeded.itemizedQuoteId}`, {
    waitUntil: "networkidle",
  });
  const carriedLines = await page.locator('input[name="lines"]').inputValue();
  const carriedTitle = await page.locator('input[name="title"]').inputValue();
  const carriedValidity = await page.locator('input[name="validUntil"]').inputValue();
  const today = new Date();
  const expectedValidity = new Date(today.getTime() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);

  check(
    "duplicate carries the line items",
    carriedLines.includes("פירוק וריצוף") && carriedLines.includes("4200"),
    carriedLines.slice(0, 120),
  );
  check("duplicate carries the subject", carriedTitle === "שיפוץ אמבטיה", carriedTitle);
  check(
    "duplicate recomputes the validity from today",
    carriedValidity === expectedValidity,
    `${carriedValidity} (expected ${expectedValidity})`,
  );

  /*
   * The print route is checked apart from the loop: it opens the browser's
   * print dialog on arrival, which would block the page forever.
   */
  await page.addInitScript(() => {
    window.print = () => {};
  });
  consoleErrors.length = 0;
  await page.goto(`${BASE}/dashboard/quotes/${seeded.itemizedQuoteId}/print`, {
    waitUntil: "networkidle",
  });
  const printBody = await page.locator("body").innerText();
  check(
    "print route renders the document",
    printBody.includes("פירוק וריצוף") &&
      printBody.includes("סה״כ לתשלום") &&
      /* Workspace details must not follow the quote onto paper. */
      !printBody.includes("הקישור ללקוח") &&
      consoleErrors.length === 0,
    consoleErrors[0]?.slice(0, 160) ?? "",
  );

  await browser.close();
}

try {
  console.log(`\nScreens against ${BASE}`);
  console.log(`Seeding through ${supabaseUrl}\n`);
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
