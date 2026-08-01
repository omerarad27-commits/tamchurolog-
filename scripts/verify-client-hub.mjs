/**
 * Checks the client hub.
 *
 * The page went from an edit form to a hub, so the risks are that it shows the
 * wrong client's quotes, that a contact link dials the wrong number, or that
 * "new quote" quietly becomes "update quote" - the last of which would look
 * fine right up until it destroyed an existing quote.
 *
 * Run:  npm run verify:client-hub
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:client-hub");
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

const email = `hubcheck-${Date.now()}@example.com`;
const PASSWORD = "hub-check-password-123";
let userId = null;
let businessId = null;
const ids = { withPhone: null, noPhone: null, other: null };
const numbers = { a: [], b: [] };

async function seedQuote(businessId, clientId, unitPrice) {
  const { data: quote } = await admin
    .from("quotes")
    .insert({ business_id: businessId, client_id: clientId })
    .select("id, quote_number")
    .single();
  await admin.from("quote_line_items").insert([
    { quote_id: quote.id, description: "עבודה", quantity: 1, unit_price: unitPrice, sort_order: 0 },
  ]);
  await admin.from("quotes").update({ status: "sent" }).eq("id", quote.id);
  return quote.quote_number;
}

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת מרכז לקוח", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses").select("id").eq("owner_user_id", userId).single();
  businessId = biz.id;

  const { data: a } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "אורי עם טלפון", phone: "0541234567" })
    .select("id").single();
  const { data: b } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה אחרת", phone: "0529998877" })
    .select("id").single();
  const { data: c } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "גיל בלי טלפון", phone: null })
    .select("id").single();

  ids.withPhone = a.id;
  ids.other = b.id;
  ids.noPhone = c.id;
  numbers.a = [await seedQuote(biz.id, a.id, 1500), await seedQuote(biz.id, a.id, 2600)];
  numbers.b = [await seedQuote(biz.id, b.id, 900)];
}

async function run() {
  await seed();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  /* ------------------------------------------------ the hub, with a phone */
  await page.goto(`${BASE}/dashboard/clients/${ids.withPhone}`, {
    waitUntil: "networkidle",
  });

  const body = await page.locator("body").innerText();
  check(
    "it lists this client's quotes",
    numbers.a.every((n) => body.includes(`#${n}`)),
    `looking for ${numbers.a.map((n) => `#${n}`).join(", ")}`,
  );
  check(
    "another client's quote is absent",
    !body.includes(`#${numbers.b[0]}`),
    `#${numbers.b[0]} must not appear`,
  );

  const wa = page.locator('a[href^="https://wa.me/"]');
  check(
    "the WhatsApp link carries the number",
    (await wa.count()) === 1 &&
      (await wa.first().getAttribute("href")) === "https://wa.me/972541234567",
    (await wa.first().getAttribute("href").catch(() => null)) ?? "absent",
  );

  const tel = page.locator('a[href^="tel:"]');
  check(
    "the call link is E.164",
    (await tel.count()) === 1 &&
      (await tel.first().getAttribute("href")) === "tel:+972541234567",
    (await tel.first().getAttribute("href").catch(() => null)) ?? "absent",
  );

  const newQuote = page.locator(`a[href*="/dashboard/quotes/new"]`);
  check(
    "the new-quote link carries the client",
    (await newQuote.count()) >= 1 &&
      (await newQuote.first().getAttribute("href")).includes(`clientId=${ids.withPhone}`),
    (await newQuote.first().getAttribute("href").catch(() => null)) ?? "absent",
  );

  /* --------------------------------------------------- the hub, no phone */
  await page.goto(`${BASE}/dashboard/clients/${ids.noPhone}`, {
    waitUntil: "networkidle",
  });
  check(
    "no contact links when there is no number",
    (await page.locator('a[href^="https://wa.me/"]').count()) === 0 &&
      (await page.locator('a[href^="tel:"]').count()) === 0,
  );
  check(
    "and it says so",
    (await page.locator("body").innerText()).includes("חסר טלפון"),
  );

  /* ------------------------------------------- new quote preselects them */
  await page.goto(`${BASE}/dashboard/quotes/new?clientId=${ids.withPhone}`, {
    waitUntil: "networkidle",
  });
  const selected = await page.locator('select[name="clientId"]').inputValue();
  check("the builder opens with the client selected", selected === ids.withPhone, selected);

  /*
   * The draft trap, asserted directly: the builder labels its submit button
   * "שמירה כטיוטה" when creating and "שמירת השינויים" when editing. If a
   * client id were ever carried in the `draft` prop, this label would flip and
   * the form would call updateQuoteAction.
   */
  const submitLabel = await page
    .getByRole("button", { name: /שמירה/ })
    .first()
    .innerText();
  check(
    "it is still a create form, not an edit form",
    submitLabel.includes("כטיוטה"),
    submitLabel,
  );

  await page.getByLabel("תיאור פריט 1").fill("בדיקת יצירה");
  await page.getByLabel("מחיר ליחידה").first().fill("400");
  await page.getByRole("button", { name: "שמירה כטיוטה" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 30000 }).catch(() => {});

  const { data: after } = await admin
    .from("quotes").select("id").eq("client_id", ids.withPhone);
  check(
    "saving created a third quote rather than updating one",
    (after?.length ?? 0) === 3,
    `${after?.length ?? 0} quotes for this client`,
  );

  /* ------------------------------------------------ editing still works */
  await page.goto(`${BASE}/dashboard/clients/${ids.withPhone}`, {
    waitUntil: "networkidle",
  });
  /*
   * Targeted by its own label, not by position.
   *
   * This used to be locator("summary").first(), which worked only while the
   * edit accordion was the sole <details> on the page. The send-a-questionnaire
   * accordion now sits above it, so .first() opened the wrong one and the edit
   * fields were never on screen. Position is not an identity.
   */
  const summary = page.getByText("עריכת פרטי הלקוח", { exact: true });
  check("the edit section is present and collapsed", (await summary.count()) === 1);
  check(
    "and it is genuinely closed until clicked",
    !(await page.getByLabel("שם מלא").isVisible()),
  );
  await summary.click();
  await page.getByLabel("שם מלא").fill("אורי אחרי עריכה");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await page.waitForTimeout(3000);

  const { data: renamed } = await admin
    .from("clients").select("full_name").eq("id", ids.withPhone).single();
  check(
    "editing from the collapsed section still saves",
    renamed?.full_name === "אורי אחרי עריכה",
    renamed?.full_name ?? "null",
  );

  /* ------------------------------------------------ intake answers show up */
  const { data: intakeForm } = await admin
    .from("intake_forms")
    .insert({
      business_id: businessId,
      name: "שאלון בדיקה",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
    })
    .select("id")
    .single();

  await admin.from("intake_requests").insert([
    {
      business_id: businessId,
      form_id: intakeForm.id,
      client_id: ids.withPhone,
      form_name: "שאלון בדיקה",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
      answers: { "text-1": "שלושה על ארבעה" },
      submitted_at: new Date().toISOString(),
    },
    {
      business_id: businessId,
      form_id: intakeForm.id,
      client_id: ids.withPhone,
      form_name: "שאלון שני",
      questions: [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }],
    },
  ]);

  await page.goto(`${BASE}/dashboard/clients/${ids.withPhone}`, { waitUntil: "networkidle" });
  const hubText = await page.locator("body").innerText();
  check("an answered questionnaire shows its question", hubText.includes("מה גודל החדר?"));
  check("and its answer", hubText.includes("שלושה על ארבעה"));
  check("an unanswered one says so", hubText.includes("טרם נענה"));

  await browser.close();
}

try {
  console.log(`\nClient hub against ${BASE}\n`);
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
