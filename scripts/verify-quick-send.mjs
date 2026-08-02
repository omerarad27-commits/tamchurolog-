/**
 * The quick quote's send, end to end.
 *
 * Written because it was broken in a way nothing else could see. The button
 * created the quote, redirected, and an effect clicked the WhatsApp link on
 * arrival. Browsers block a target="_blank" navigation no gesture started, so
 * WhatsApp never opened -- but the synthetic click still ran React's onClick,
 * which reports the send. The quote was marked as sent to a client who had
 * received nothing, and every screen in the app agreed with the lie.
 *
 * So this checks the two halves separately: that arriving does NOT report a
 * send, and that the owner's own tap does.
 *
 * Output is English on purpose - Windows terminals mangle Hebrew.
 *
 * Run:  npm run verify:quick-send
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3000";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:quick-send");
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

const email = `quicksend-${Date.now()}@example.com`;
const PASSWORD = "quick-send-password-123";
let userId = null;

async function run() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת שליחה", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses").select("id").eq("owner_user_id", userId).single();
  await admin.from("businesses").update({ phone: "0541234567" }).eq("id", biz.id);
  await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "אורי כהן", phone: "0541234567" });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  /* wa.me is somebody else's server and this suite must not touch it. The
     request is answered locally; what matters is the URL that was opened. */
  await ctx.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "ok" }),
  );

  const page = await ctx.newPage();
  const popups = [];
  ctx.on("page", (p) => popups.push(p));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  await page.goto(`${BASE}/dashboard/quotes/quick`, { waitUntil: "networkidle" });
  await page.selectOption('select[name="clientId"]', { label: "אורי כהן" });
  await page.fill('input[name="title"]', "תיקון נזילה");
  await page.fill('input[name="amount"]', "400");
  await page.getByRole("button", { name: "שליחה בוואטסאפ" }).click();

  /* The id, not "**\/quotes/**" - that also matches /quotes/quick, which is
     the page we started on. */
  await page.waitForURL(/\/dashboard\/quotes\/[0-9a-f-]{36}/, { timeout: 30000 });
  check("the quick quote lands on the new quote", page.url().includes("send=1"), page.url());

  /* Long enough that a stray auto-send would have happened by now. */
  await page.waitForTimeout(3000);

  const quoteId = new URL(page.url()).pathname.split("/").pop();
  const readStatus = async () => {
    const { data } = await admin
      .from("quotes").select("status, sent_at").eq("id", quoteId).single();
    return data;
  };

  const onArrival = await readStatus();
  check(
    "arriving does NOT report the quote as sent",
    onArrival.status === "draft" && onArrival.sent_at === null,
    `status=${onArrival.status} sent_at=${onArrival.sent_at}`,
  );
  check("nothing was opened without a tap", popups.length === 0, `${popups.length} popup(s)`);

  const sendLink = page.getByRole("link", { name: "שליחה בוואטסאפ" });
  check("the send button is on the page", (await sendLink.count()) === 1);
  check(
    "it already holds the focus, so the next tap sends",
    await page.evaluate(() => document.activeElement?.tagName === "A"),
  );
  check(
    "the owner is told what is left to do",
    (await page.getByRole("status").filter({ hasText: "נשאר רק לשלוח" }).count()) === 1,
  );

  /* The real tap. */
  const [opened] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 15000 }),
    sendLink.click(),
  ]);
  const openedUrl = opened.url();

  check("tapping it opens WhatsApp", openedUrl.startsWith("https://wa.me/"), openedUrl);
  check(
    "the link carries the client's number",
    openedUrl.includes("972541234567"),
    openedUrl.slice(0, 60),
  );
  check(
    "the message carries the quote's own link",
    decodeURIComponent(openedUrl).includes("/q/"),
  );
  check(
    "the subject is in the message",
    decodeURIComponent(openedUrl).includes("תיקון נזילה"),
  );

  /* The action reporting the send runs alongside the navigation. */
  await page.waitForTimeout(3000);
  const afterTap = await readStatus();
  check(
    "the tap reports the quote as sent",
    afterTap.status === "sent" && afterTap.sent_at !== null,
    `status=${afterTap.status}`,
  );

  await browser.close();
}

try {
  console.log(`\nQuick quote send against ${BASE}\n`);
  await run();
} catch (error) {
  console.error("\nERROR:", error.message);
  results.push({ name: "suite completed", passed: false });
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
