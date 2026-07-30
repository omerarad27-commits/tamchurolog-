/**
 * Checks the Content-Security-Policy against a running build.
 *
 * The acceptance test for a CSP is not that the header exists, it is that
 * nothing on the site is refused by it. A policy that blocks a hydration script
 * looks perfect in curl and ships a dead page, so this drives a real browser
 * over every route that matters and fails on the first violation.
 *
 * Must run against a production build (npm run build && npm run start).
 * Development loosens the policy with 'unsafe-eval' and serves an error
 * overlay, so a clean dev run proves nothing about production.
 *
 * Run:  npm run verify:csp
 *       npm run verify:csp -- --url https://tamchurolog.vercel.app
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
  console.error("Missing env vars. Run via: npm run verify:csp");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(
    `  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`,
  );
}

const email = `cspcheck-${Date.now()}@example.com`;
const PASSWORD = "csp-check-password-123";
let userId = null;
let publicToken = null;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת CSP", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה לוי", phone: "0541112233" })
    .select("id")
    .single();

  const { data: quote } = await admin
    .from("quotes")
    .insert({ business_id: biz.id, client_id: client.id })
    .select("id, public_token")
    .single();

  await admin.from("quote_line_items").insert([
    { quote_id: quote.id, description: "התקנת מזגן", quantity: 1, unit_price: 1800, sort_order: 0 },
  ]);

  publicToken = quote.public_token;
}

async function run() {
  await seed();

  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  // Two independent reporters. The console message is what a developer sees,
  // but a violation on a resource that never reaches the document (a blocked
  // preload, for instance) only shows up as the DOM event.
  const violations = [];
  await ctx.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(
        `CSPVIOLATION ${e.effectiveDirective} blocked ${e.blockedURI}`,
      );
    }),
  );

  const page = await ctx.newPage();
  let current = "";
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("CSPVIOLATION") ||
      text.includes("Refused to load") ||
      text.includes("Refused to execute") ||
      text.includes("Refused to apply") ||
      text.includes("Refused to connect") ||
      text.includes("Content Security Policy")
    ) {
      violations.push(`${current}: ${text.slice(0, 200)}`);
    }
  });
  page.on("pageerror", (err) => {
    violations.push(`${current}: pageerror ${String(err).slice(0, 160)}`);
  });

  const visit = async (name, path, settle = 1200) => {
    current = name;
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    // Hydration and any lazily imported chunk land after the network settles.
    await page.waitForTimeout(settle);
  };

  /* ------------------------------------------------- the header itself */
  const response = await page.goto(`${BASE}/login`, {
    waitUntil: "domcontentloaded",
  });
  const csp = response.headers()["content-security-policy"] ?? "";
  check("a CSP header is served", csp.length > 0, `${csp.length} chars`);
  check(
    "it carries a per-request nonce",
    /'nonce-[a-f0-9]{16,}'/.test(csp),
    csp.match(/'nonce-[a-f0-9]+'/)?.[0]?.slice(0, 20) ?? "none",
  );
  for (const directive of [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "connect-src",
    "font-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
  ]) {
    check(`policy declares ${directive}`, csp.includes(`${directive} `));
  }
  check("scripts are strict-dynamic", csp.includes("'strict-dynamic'"));
  check(
    "production drops unsafe-eval",
    BASE.includes("localhost") || !csp.includes("'unsafe-eval'"),
  );

  // Two requests must not reuse a nonce.
  const second = await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const csp2 = second.headers()["content-security-policy"] ?? "";
  check(
    "the nonce differs between requests",
    csp !== csp2 && csp2.includes("nonce-"),
  );

  const coop = second.headers()["cross-origin-opener-policy"];
  check("Cross-Origin-Opener-Policy is set", coop === "same-origin", coop ?? "absent");

  /* ------------------------------------------ every document, in a browser */
  await visit("home", "/");
  await visit("login", "/login");
  await visit("signup", "/signup");
  await visit("404", "/definitely-not-a-real-page");
  await visit("public quote", `/q/${publicToken}`);

  // Signed-in routes.
  current = "sign-in";
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  await visit("dashboard", "/dashboard");
  await visit("new quote form", "/dashboard/quotes/new");
  await visit("settings", "/dashboard/settings");
  await visit("stats", "/dashboard/stats");
  await visit("clients", "/dashboard/clients");

  /* ------------------------------------ the app still works under the policy */
  current = "interaction";
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle" });
  await page.getByLabel("שם העסק").fill("שם אחרי CSP");
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.getByText("הפרטים נשמרו").first().waitFor({ timeout: 20000 }).catch(() => {});
  const { data: row } = await admin
    .from("businesses")
    .select("name")
    .eq("owner_user_id", userId)
    .single();
  check(
    "a Server Action still writes under the policy",
    row?.name === "שם אחרי CSP",
    `name=${row?.name}`,
  );

  // Hydration is the thing a bad script-src kills, and it is invisible in the
  // HTML: only a working client handler proves the bundle actually ran.
  current = "hydration";
  await page.goto(`${BASE}/q/${publicToken}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "אישור ההצעה" }).click();
  const signature = page.getByLabel("אנא הקלד/י את שמך המלא לאישור");
  await signature.waitFor({ timeout: 10000 }).catch(() => {});
  check("the quote page hydrates and reacts", await signature.count() > 0);

  check(
    "no CSP violations anywhere",
    violations.length === 0,
    violations.length ? `\n      ${violations.slice(0, 8).join("\n      ")}` : "clean",
  );

  await browser.close();
}

try {
  console.log(`\nCSP against ${BASE}\n`);
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
