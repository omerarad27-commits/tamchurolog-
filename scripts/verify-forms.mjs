/**
 * Checks the questionnaire library and builder.
 *
 * Run:  npm run verify:forms   (against a production build on :3100)
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

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

const email = `forms-${Date.now()}@example.com`;
const PASSWORD = "forms-check-password-123";
const FORM_NAME = "שאלון בדיקה";
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

  /* ---------------------------------------------------------- sign up */
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת שאלונים");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  /* ------------------------------------------------------ reachable */
  check(
    "there is a nav link to the library",
    (await page.locator('a[href="/dashboard/forms"]').count()) >= 1,
  );

  await page.goto(`${BASE}/dashboard/forms`, { waitUntil: "networkidle" });
  check(
    "an owner with no forms is told so",
    (await page.locator("body").innerText()).includes("עדיין לא יצרת שאלון"),
  );

  /* -------------------------------------------------- empty rejected */
  await page.goto(`${BASE}/dashboard/forms/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForSelector('p[role="alert"]', { timeout: 10000 });
  check("a form with no name is rejected", page.url().includes("/forms/new"));

  await page.fill('input[name="name"]', FORM_NAME);
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForTimeout(1500);
  check(
    "a form with no questions is rejected",
    page.url().includes("/forms/new") &&
      (await page.locator('p[role="alert"]').innerText()).includes("שאלה אחת"),
  );

  /* ------------------------------------------------------- build one */
  // React resets uncontrolled form fields after every action submission that
  // does not redirect - including this one, which only failed on the
  // questions. The name field is uncontrolled (TextField uses defaultValue),
  // so it must be re-filled here even though nothing about it was invalid.
  await page.fill('input[name="name"]', FORM_NAME);
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "+ הוספת שאלה" }).click();
  await page.getByLabel("שאלה 1", { exact: true }).fill("מה גודל החדר?");
  await page.getByRole("button", { name: "שמירת השאלון" }).click();
  await page.waitForURL("**/dashboard/forms", { timeout: 20000 });
  check("saving a valid form returns to the library", true);

  const { data: saved } = await admin
    .from("intake_forms")
    .select("id, name, questions")
    .eq("business_id", biz.id)
    .single();

  check("the form is in the database", Boolean(saved), saved?.name ?? "null");
  check("it kept its name", saved?.name === FORM_NAME);
  check("it has two questions", saved?.questions?.length === 2, String(saved?.questions?.length));
  check(
    "the bank question kept its key as its id and its options",
    saved?.questions?.[0]?.id === "floor_elevator" &&
      saved?.questions?.[0]?.options?.length === 5,
  );
  check(
    "the free-text question is a text question",
    saved?.questions?.[1]?.kind === "text" &&
      saved?.questions?.[1]?.prompt === "מה גודל החדר?",
  );

  /* -------------------------------------------------------- it round-trips */
  await page.goto(`${BASE}/dashboard/forms/${saved.id}`, { waitUntil: "networkidle" });
  check(
    "reopening it shows the saved name",
    (await page.locator('input[name="name"]').inputValue()) === FORM_NAME,
  );
  check(
    "reopening it shows the saved free text",
    (await page.getByLabel("שאלה 1", { exact: true }).inputValue()) === "מה גודל החדר?",
  );
  check(
    "reopening it shows the bank question ticked",
    await page.locator('input[type="checkbox"]').first().isChecked(),
  );

  await browser.close();
}

try {
  console.log(`\nForm library against ${BASE}\n`);
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
