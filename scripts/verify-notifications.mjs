/**
 * Checks that a submitted questionnaire raises a notification, that it is
 * scoped to one business, and that opening the list marks it read.
 *
 * Run:  npm run verify:notifications   (against a production build on :3100)
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

const stamp = Date.now();
const PASSWORD = "notif-check-password-123";
const emails = [`notif-a-${stamp}@example.com`, `notif-b-${stamp}@example.com`];
const userIds = [];

async function signUp(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    }),
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת התראות");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: "פתיחת חשבון" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const { data: found } = await admin.auth.admin.listUsers();
  const userId = found.users.find((u) => u.email === email).id;
  userIds.push(userId);
  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  return { page, businessId: biz.id };
}

async function run() {
  const browser = await chromium.launch();
  const a = await signUp(browser, emails[0]);
  const b = await signUp(browser, emails[1]);

  /* ------------------------------------------------ a submission raises one */
  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: a.businessId, full_name: "דנה לוי" })
    .select("id")
    .single();

  const questions = [{ id: "text-1", kind: "text", prompt: "מה גודל החדר?" }];
  const { data: request } = await admin
    .from("intake_requests")
    .insert({
      business_id: a.businessId,
      client_id: client.id,
      form_name: "שאלון בדיקה",
      questions,
    })
    .select("id, public_token")
    .single();

  const anon = await browser.newContext({ viewport: { width: 390, height: 850 } });
  const clientPage = await anon.newPage();
  await clientPage.goto(`${BASE}/f/${request.public_token}`, { waitUntil: "networkidle" });
  await clientPage.locator('textarea[name="text-1"]').fill("שלושה מטר");
  await clientPage.getByRole("button", { name: "שליחת התשובות" }).click();
  await clientPage.waitForSelector("text=תודה", { timeout: 20000 });

  const { data: raised } = await admin
    .from("notifications")
    .select("id, kind, subject_name, intake_request_id, read_at")
    .eq("business_id", a.businessId);

  check("exactly one notification was raised", raised.length === 1, String(raised.length));
  check("it is the right kind", raised[0]?.kind === "intake_submitted");
  check("it snapshotted the client's name", raised[0]?.subject_name === "דנה לוי");
  check("it points at the request", raised[0]?.intake_request_id === request.id);
  check("it starts unread", raised[0]?.read_at === null);

  /* ------------------------------------------------------- another business */
  const { data: theirs } = await admin
    .from("notifications")
    .select("id")
    .eq("business_id", b.businessId);
  check("the other business has none", theirs.length === 0);

  await b.page.goto(`${BASE}/dashboard/notifications`, { waitUntil: "networkidle" });
  check(
    "and is told the list is empty",
    (await b.page.locator("body").innerText()).includes("אין התראות"),
  );

  /* --------------------------------------------------------------- the bell */
  await a.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const bell = a.page.locator('a[href="/dashboard/notifications"]');
  check("there is a bell in the header", (await bell.count()) >= 1);
  check(
    "it announces the unread count",
    (await bell.first().getAttribute("aria-label")).includes("1"),
  );

  /* ---------------------------------------------------- opening marks read */
  await a.page.goto(`${BASE}/dashboard/notifications`, { waitUntil: "networkidle" });
  check(
    "the list names the client",
    (await a.page.locator("body").innerText()).includes("דנה לוי"),
  );

  /*
   * Finding C: notificationHref used to return /dashboard/notifications for
   * an intake_submitted row - the list you are already on. The answers live
   * on the client's card, so tapping the notification must go there instead.
   */
  const notifLink = a.page.getByRole("link", { name: /התקבלו תשובות לשאלון/ });
  check("there is a link for the submitted questionnaire", (await notifLink.count()) === 1);
  const notifHref = await notifLink.first().getAttribute("href").catch(() => null);
  check(
    "it links to the client, not back to the notifications list",
    notifHref === `/dashboard/clients/${client.id}`,
    notifHref ?? "absent",
  );

  const { data: afterOpen } = await admin
    .from("notifications")
    .select("read_at")
    .eq("business_id", a.businessId);
  check("opening the list marked it read", afterOpen.every((n) => n.read_at !== null));

  await a.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check(
    "the bell no longer shows a count",
    (await a.page.locator('a[href="/dashboard/notifications"]').first().getAttribute("aria-label")) ===
      "התראות",
  );

  await browser.close();
}

try {
  console.log(`\nNotifications against ${BASE}\n`);
  await run();
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  process.exit(1);
}
