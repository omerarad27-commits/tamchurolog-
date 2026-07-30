/**
 * Checks the unsaved-changes notice on the settings form.
 *
 * The notice is driven by one onChange on the <form>, which relies on native
 * change events bubbling. That either covers every field or silently misses
 * some, and a build passing says nothing about which. This drives a real
 * browser: it edits each kind of field in turn, and confirms the notice appears,
 * that it is sticky and orange, that saving still works with a handler sitting
 * on the form, and that a successful save clears it.
 *
 * Run:  npm run verify:settings
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
  console.error("Missing env vars. Run via: npm run verify:settings");
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

const NOTICE = "כדי לשמור שינויים";
const email = `settingscheck-${Date.now()}@example.com`;
const PASSWORD = "settings-check-password-123";
let userId = null;

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The dev overlay sits above the page and eats clicks.
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent =
        "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();

  const notice = page.getByText(NOTICE);
  const gotoSettings = async () => {
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle" });
    await page.getByLabel("שם העסק").waitFor({ timeout: 15000 });
  };

  /* ---------------------------------------------------------- sign up */
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="businessName"]', "בדיקת הגדרות");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  userId = found?.users?.find((u) => u.email === email)?.id ?? null;

  /* -------------------------------------------------- clean by default */
  await gotoSettings();
  check("no notice on a freshly loaded form", (await notice.count()) === 0);

  /* ----------------------------------------------- field by field ---- */
  // Each starts from a clean load, so one field's pass cannot be another's.
  await page.getByLabel("שם העסק").fill("שם חדש");
  await notice.first().waitFor({ timeout: 5000 }).catch(() => {});
  check("typing in a text field raises the notice", (await notice.count()) > 0);

  await gotoSettings();
  await page.getByLabel("תנאים והערות ברירת מחדל").fill("תנאים חדשים");
  await notice.first().waitFor({ timeout: 5000 }).catch(() => {});
  check("typing in the textarea raises the notice", (await notice.count()) > 0);

  await gotoSettings();
  // The VAT picker is a custom component wrapping native radios.
  await page.getByRole("radio").last().check();
  await notice.first().waitFor({ timeout: 5000 }).catch(() => {});
  check("choosing a business type raises the notice", (await notice.count()) > 0);

  /* --------------------------------------------------- looks and place */
  // The entrance animation starts the alert 6px high, so measuring position
  // straight away measures the animation instead of the layout.
  await notice
    .first()
    .evaluate((el) =>
      Promise.all(
        (el.closest("div")?.getAnimations() ?? []).map((a) => a.finished),
      ),
    );

  const style = await notice.first().evaluate((el) => {
    const box = el.closest("div");
    const alert = el.closest("p") ?? el;
    return {
      position: getComputedStyle(box).position,
      color: getComputedStyle(alert).color,
      role: alert.getAttribute("role"),
      // Distance from the alert's top to the form's top: proves it is the
      // first thing in the form rather than buried mid-page.
      offset: Math.round(
        alert.getBoundingClientRect().top -
          el.closest("form").getBoundingClientRect().top,
      ),
    };
  });
  check("the notice is sticky", style.position === "sticky", style.position);
  // --warning is #b54708.
  check(
    "the notice is orange",
    style.color === "rgb(181, 71, 8)",
    style.color,
  );
  check("the notice is a live region", style.role === "status", `role=${style.role}`);
  check("the notice sits at the top of the form", style.offset === 0, `${style.offset}px`);

  /* ------------------------------- it stays in view once scrolled away */
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  const stuck = await notice.first().evaluate((el) => {
    const r = (el.closest("p") ?? el).getBoundingClientRect();
    return { top: Math.round(r.top), visible: r.top >= 0 && r.top < 120 };
  });
  check(
    "the notice is still on screen after scrolling",
    stuck.visible,
    `top=${stuck.top}px`,
  );

  /* ---------------------------------------------- saving still works  */
  // The real risk of putting a handler on the form: breaking the action.
  await gotoSettings();
  await page.getByLabel("שם העסק").fill("נשמר בהצלחה");
  await notice.first().waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "שמירה" }).click();

  const saved = page.getByText("הפרטים נשמרו");
  await saved.first().waitFor({ timeout: 20000 }).catch(() => {});
  check("the form still saves", (await saved.count()) > 0);

  const { data: row } = await admin
    .from("businesses")
    .select("name")
    .eq("owner_user_id", userId)
    .single();
  check(
    "the new name reached the database",
    row?.name === "נשמר בהצלחה",
    `name=${row?.name}`,
  );

  check("a successful save clears the notice", (await notice.count()) === 0);

  /* ------------------------------------ and comes back on the next edit */
  await page.getByLabel("שם העסק").fill("עוד שינוי");
  await notice.first().waitFor({ timeout: 5000 }).catch(() => {});
  check("editing after a save raises it again", (await notice.count()) > 0);
  check(
    "the stale 'saved' message is gone once dirty again",
    (await saved.count()) === 0,
  );

  /* --------------------------------------------- a failed save keeps it */
  // The changes really are still unsaved, so the notice must not clear. An
  // empty business name is the action's own validation error.
  await page.getByLabel("שם העסק").fill("");
  await page.getByRole("button", { name: "שמירה" }).click();
  const failure = page.getByText("יש להזין את שם העסק");
  await failure.first().waitFor({ timeout: 20000 }).catch(() => {});
  check("a rejected save reports the error", (await failure.count()) > 0);
  check("a rejected save keeps the notice up", (await notice.count()) > 0);

  // And recovering from that error still clears it.
  await page.getByLabel("שם העסק").fill("אחרי תיקון");
  await page.getByRole("button", { name: "שמירה" }).click();
  await saved.first().waitFor({ timeout: 20000 }).catch(() => {});
  check("saving after fixing the error clears the notice", (await notice.count()) === 0);

  await browser.close();
}

try {
  console.log(`\nSettings notice against ${BASE}\n`);
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
