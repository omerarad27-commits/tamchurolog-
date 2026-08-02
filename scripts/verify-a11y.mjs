/**
 * Checks the keyboard and landmark fixes.
 *
 * A skip link that exists in the markup but never receives focus, or receives
 * it and moves nothing, is worse than none at all - it looks handled. So this
 * presses Tab like a keyboard user and follows what actually happens.
 *
 * Run:  npm run verify:a11y
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:a11y");
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

const email = `a11ycheck-${Date.now()}@example.com`;
const PASSWORD = "a11y-check-password-123";
let userId = null;
let publicToken = null;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת נגישות", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses").select("id").eq("owner_user_id", userId).single();
  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "אורי כהן", phone: "0541234567" })
    .select("id").single();
  /*
   * Sent, not left as a draft. An unsent quote is not reachable at its public
   * link - it is a price still being worked out - so a draft would give this
   * script a 404 to inspect for landmarks and footer links.
   */
  const { data: quote } = await admin
    .from("quotes")
    .insert({
      business_id: biz.id,
      client_id: client.id,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id, public_token").single();
  await admin.from("quote_line_items").insert([
    { quote_id: quote.id, description: "עבודה", quantity: 1, unit_price: 500, sort_order: 0 },
  ]);
  publicToken = quote.public_token;
}

async function run() {
  await seed();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  /* ------------------------------------------------------- skip link */
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");

  const first = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, text: el?.textContent?.trim(), href: el?.getAttribute("href") };
  });
  check(
    "the first Tab reaches the skip link",
    first.href === "#main",
    `${first.tag} "${first.text}"`,
  );

  // Hidden until focused: it must not occupy space in the normal flow.
  const visibleWhenFocused = await page
    .getByRole("link", { name: "דילוג לתוכן" })
    .isVisible();
  check("it becomes visible on focus", visibleWhenFocused);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const afterSkip = await page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id, tag: el?.tagName };
  });
  check(
    "activating it moves focus into the content",
    afterSkip.id === "main" || afterSkip.tag === "MAIN",
    `${afterSkip.tag}#${afterSkip.id}`,
  );

  // Without the link, the same journey costs six stops.
  const controlsBeforeMain = await page.evaluate(() => {
    const main = document.getElementById("main");
    const focusable = [...document.querySelectorAll('a[href],button,input,select,textarea')]
      .filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    const idx = focusable.findIndex((el) => main?.contains(el));
    return idx;
  });
  check(
    "it is not merely decorative",
    controlsBeforeMain > 1,
    `${controlsBeforeMain} controls precede the content`,
  );

  /* --------------------------------------------------- quote page footer */
  await page.goto(`${BASE}/q/${publicToken}`, { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  check("the quote page has a footer landmark", (await footer.count()) === 1);
  /* Two links now, so each is asserted by name. The footer carried only the
     home link until the accessibility statement had to be reachable from the
     document itself and not just from the floating menu. */
  const footerHrefs = await footer.getByRole("link").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  check(
    "the footer links home",
    footerHrefs.includes("/"),
    footerHrefs.join(", ") || "none",
  );
  check(
    "the footer links to the accessibility statement",
    footerHrefs.includes("/accessibility"),
    footerHrefs.join(", ") || "none",
  );

  /* ------------------------------------------ accessibility menu button */
  const a11yButton = page.getByRole("button", { name: "פתיחת תפריט נגישות" });
  check("the accessibility menu button is on the quote page", (await a11yButton.count()) === 1);

  await a11yButton.click();
  const dialog = page.locator("dialog[open]");
  check("it opens a modal dialog", (await dialog.count()) === 1);

  /* The point of a native <dialog>: Escape closes it and focus comes back. */
  await page.keyboard.press("Escape");
  check("Escape closes it", (await page.locator("dialog[open]").count()) === 0);
  check(
    "focus returns to the button that opened it",
    await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") === "פתיחת תפריט נגישות",
    ),
  );

  /* High contrast has to reach the page, not just the menu's own state. */
  await a11yButton.click();
  await page.getByText("ניגודיות גבוהה", { exact: true }).click();
  check(
    "choosing high contrast marks the document",
    (await page.locator("html[data-a11y-contrast=\"high\"]").count()) === 1,
  );
  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  check(
    "the choice survives a reload",
    (await page.locator("html[data-a11y-contrast=\"high\"]").count()) === 1,
  );

  /* ------------------------------------------------------- theme-color */
  const themeColors = await page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({
      media: m.getAttribute("media"),
      content: m.getAttribute("content"),
    })),
  );
  check(
    "theme-color has a light and a dark value",
    themeColors.length === 2 &&
      themeColors.some((t) => t.media?.includes("dark")) &&
      themeColors.some((t) => t.media?.includes("light")),
    JSON.stringify(themeColors),
  );

  await browser.close();
}

try {
  console.log(`\nAccessibility against ${BASE}\n`);
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
