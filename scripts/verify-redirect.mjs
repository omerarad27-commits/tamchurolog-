/**
 * Checks that ?next= can only ever land somewhere on this site.
 *
 * An open redirect is not visible in the markup and not reachable without
 * credentials, so this signs in for real and follows where the browser
 * actually goes. Both entry points are covered: signing in with a ?next=, and
 * arriving at /login with a ?next= while already signed in, which the proxy
 * answers instead.
 *
 * Run:  npm run verify:redirect
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
  console.error("Missing env vars. Run via: npm run verify:redirect");
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

const email = `redirectcheck-${Date.now()}@example.com`;
const PASSWORD = "redirect-check-password-123";
let userId = null;

/*
 * Each hostile value and where it must NOT end up. The backslash and
 * backslash-backslash forms are the ones a naive startsWith("//") misses:
 * the browser rewrites "\" to "/" when it resolves the Location header.
 */
const HOSTILE = [
  "https://example.com/",
  "//example.com/",
  "/\\example.com/",
  "/\\/example.com/",
  "javascript:alert(1)",
  "https://example.com\\@tamchurolog.vercel.app/",
];

const INTERNAL = [
  ["/dashboard/clients", "/dashboard/clients"],
  ["/dashboard/settings", "/dashboard/settings"],
  ["/dashboard/stats", "/dashboard/stats"],
];

async function run() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת הפניה", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const browser = await chromium.launch();

  /* ------------------------------- signing in, with next= on the form */
  for (const [next, expected] of INTERNAL) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.getByRole("button", { name: "התחברות" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    const landed = new URL(page.url());
    check(
      `sign-in with next=${next} lands there`,
      landed.pathname === expected,
      landed.pathname,
    );
    await ctx.close();
  }

  for (const next of HOSTILE) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.getByRole("button", { name: "התחברות" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    const landed = new URL(page.url());
    check(
      `sign-in with next=${next} stays on site`,
      landed.origin === new URL(BASE).origin && landed.pathname === "/dashboard",
      `${landed.origin}${landed.pathname}`,
    );
    await ctx.close();
  }

  /* ------------------- already signed in, hitting /login with a next= */
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  await page.goto(`${BASE}/login?next=%2Fdashboard%2Fstats`, {
    waitUntil: "domcontentloaded",
  });
  check(
    "a signed-in user following a deep link reaches it",
    new URL(page.url()).pathname === "/dashboard/stats",
    new URL(page.url()).pathname,
  );

  for (const next of HOSTILE) {
    await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, {
      waitUntil: "domcontentloaded",
    });
    const landed = new URL(page.url());
    check(
      `signed-in with next=${next} stays on site`,
      landed.origin === new URL(BASE).origin && landed.pathname === "/dashboard",
      `${landed.origin}${landed.pathname}`,
    );
  }

  await browser.close();
}

try {
  console.log(`\nRedirect safety against ${BASE}\n`);
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
