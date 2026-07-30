/**
 * End-to-end check of the signed-in flow and the auth cookie's flags.
 *
 * Making the session cookie httpOnly is the kind of change that either works or
 * silently signs everybody out, and a build passing says nothing about it. This
 * drives a real browser through sign-up, navigation, a Server Action write, a
 * reload, and sign-out, and inspects the cookie at each point.
 *
 * Run:  npm run verify:auth
 *       npm run verify:auth -- --url https://tamchurolog.vercel.app
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3000";
const IS_LOCAL = BASE.startsWith("http://localhost");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:auth");
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

const stamp = Date.now();
const email = `authcheck-${stamp}@example.com`;
const PASSWORD = "auth-check-password-123";
let userId = null;

const authCookies = async (ctx) =>
  (await ctx.cookies()).filter((c) => c.name.includes("auth-token"));

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();

  /* ---------------------------------------------------------- sign up */
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="businessName"]', "בדיקת אימות");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  check("sign-up reaches the dashboard", true);

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;

  /* ------------------------------------------------------ cookie flags */
  const jar = await authCookies(ctx);
  check("an auth cookie was set", jar.length > 0, `${jar.length} cookie(s)`);
  check(
    "every auth cookie is httpOnly",
    jar.length > 0 && jar.every((c) => c.httpOnly),
    jar.map((c) => `${c.name.slice(0, 24)}:httpOnly=${c.httpOnly}`).join(" "),
  );
  check(
    "every auth cookie is sameSite=Lax",
    jar.every((c) => c.sameSite === "Lax"),
  );
  if (!IS_LOCAL) {
    check("every auth cookie is secure", jar.every((c) => c.secure));
  } else {
    console.log("  [skip] secure flag - off by design on http://localhost");
  }

  const viaJs = await page.evaluate(() => document.cookie);
  check(
    "the token is NOT readable from document.cookie",
    !/sb-.*auth-token/.test(viaJs),
  );

  /* ------------------------------------------------ the app still works */
  await page.getByRole("link", { name: "לקוחות", exact: true }).click();
  await page.waitForURL("**/dashboard/clients", { timeout: 30000 });
  check("soft navigation keeps the session", true);

  // A Server Action write is the real test: it reads the cookie server side.
  await page.getByRole("link", { name: "לקוח חדש", exact: true }).click();
  await page.waitForURL("**/dashboard/clients/new", { timeout: 30000 });
  await page.fill('input[name="fullName"]', "לקוח בדיקה");
  await page.fill('input[name="phone"]', "0541234567");
  /*
   * By name, never by button[type="submit"].
   *
   * The dashboard header carries the sign-out control, which is also a form with
   * a submit button, and it comes first in the DOM. A generic submit selector
   * clicks that one, which signs out, clears the cookies and lands on /login.
   * Read as an application bug for a while; it was this line.
   */
  await page.getByRole("button", { name: "הוספת לקוח" }).click();
  // Exact pathname: a "**/dashboard/clients**" glob also matches the /new page
  // we are already on, so it would resolve instantly and prove nothing.
  await page
    .waitForURL((u) => u.pathname === "/dashboard/clients", { timeout: 30000 })
    .catch(() => {});
  // Wait for the row rather than counting immediately; the redirect resolves
  // before the list has rendered.
  const created = await page
    .getByText("לקוח בדיקה")
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check(
    "a Server Action write succeeds",
    created,
    created ? "" : `ended at ${page.url()}`,
  );

  /* ------------------------------------------------------ hard reload */
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check(
    "session survives a full page load",
    page.url().includes("/dashboard") && !page.url().includes("/login"),
  );

  const afterReload = await authCookies(ctx);
  check(
    "the refreshed cookie is still httpOnly",
    afterReload.length > 0 && afterReload.every((c) => c.httpOnly),
  );

  /* -------------------------------------------------------- sign out */
  await page.getByRole("button", { name: "יציאה" }).click();
  await page.waitForURL("**/login", { timeout: 30000 });
  check("sign-out returns to the login page", true);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/login**", { timeout: 30000 });
  check("the dashboard is refused once signed out", true);

  await browser.close();
}

try {
  console.log(`\nAuth flow against ${BASE}\n`);
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
