/**
 * Checks the landing page.
 *
 * The page now carries the signup form itself, which makes it the first thing
 * that can break a signup. So this does not check that the form renders — it
 * signs somebody up through it and looks in the database.
 *
 * It also guards the work already on this page: the canonical tag and the
 * dev-only connection card both live here and are easy to lose in a rewrite.
 *
 * Run:  npm run verify:landing
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
  console.error("Missing env vars. Run via: npm run verify:landing");
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

const email = `landing-${Date.now()}@example.com`;
const PASSWORD = "landing-check-password-123";
const BUSINESS = "מסגריית בן דוד";
let userId = null;

async function run() {
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

  /* ------------------------------------------------ signed out, the pitch */
  await page.goto(BASE, { waitUntil: "networkidle" });
  const html = await page.content();
  const text = await page.locator("body").innerText();

  check(
    "there is exactly one h1",
    (await page.locator("h1").count()) === 1,
    String(await page.locator("h1").count()),
  );
  check(
    "it explains what the product does",
    text.includes("הצעות מחיר"),
  );
  check(
    "it names the three things it does",
    text.includes("וואטסאפ") && text.includes("נפתחה") && text.includes("מאשר"),
  );

  /* ------------------------------------------------- the form is right here */
  check(
    "the signup form is on the page itself",
    (await page.locator('input[name="businessName"]').count()) === 1 &&
      (await page.locator('input[name="email"]').count()) === 1 &&
      (await page.locator('input[name="password"]').count()) === 1,
  );
  check(
    "the business type picker came with it",
    (await page.locator('input[name="businessType"]').count()) >= 2,
  );
  check(
    "there is a link to sign in",
    (await page.locator('a[href="/login"]').count()) >= 1,
  );

  /* ---------------------------------------------- what was already here */
  check(
    "the canonical tag survived",
    /rel="canonical"/.test(html),
  );
  check(
    "the share card metadata survived",
    /property="og:title"/.test(html) && /property="og:image"/.test(html),
  );

  /* ------------------------------------------------- it actually signs up */
  await page.fill('input[name="businessName"]', BUSINESS);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  check("signing up from the landing page reaches the dashboard", true);

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;
  check("the account exists", Boolean(userId));

  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("owner_user_id", userId)
    .single();
  check(
    "the business was created with the name typed on the landing page",
    biz?.name === BUSINESS,
    biz?.name ?? "null",
  );

  /* -------------------------------------------- signed in, no form shown */
  await page.goto(BASE, { waitUntil: "networkidle" });
  check(
    "a signed-in visitor is not shown the signup form",
    (await page.locator('input[name="businessName"]').count()) === 0,
  );
  check(
    "and is offered the dashboard",
    (await page.locator('a[href="/dashboard"]').count()) >= 1,
  );

  /* ------------------------------------------------ the old routes remain */
  for (const path of ["/login", "/signup"]) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    check(`${path} still answers`, res.status === 200, String(res.status));
  }

  await browser.close();
}

try {
  console.log(`\nLanding page against ${BASE}\n`);
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
