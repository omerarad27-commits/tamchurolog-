/**
 * Sends a questionnaire, answers it as an anonymous client, and checks that
 * the answers land keyed by question id and cannot be overwritten.
 *
 * Run:  npm run verify:intake   (against a production build on :3100)
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

const email = `intake-${Date.now()}@example.com`;
const PASSWORD = "intake-check-password-123";
let userId = null;

async function run() {
  const browser = await chromium.launch();
  const hidePortal = () =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important;pointer-events:none!important}";
      document.head.appendChild(s);
    });

  const owner = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await owner.addInitScript(hidePortal);
  const page = await owner.newPage();

  /* ------------------------------------------------- owner: set the stage */
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="businessName"]', "בדיקת שאלון");
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

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "דנה לוי", phone: "+972541234567" })
    .select("id")
    .single();

  const { data: form } = await admin
    .from("intake_forms")
    .insert({
      business_id: biz.id,
      name: "שאלון בדיקה",
      questions: [
        {
          id: "floor_elevator",
          kind: "choice",
          prompt: "האם מדובר בבניין ללא מעלית, ואם כן באיזו קומה?",
          options: ["לא", "1", "2", "3", "4"],
        },
        { id: "text-1", kind: "text", prompt: "מה גודל החדר?" },
      ],
    })
    .select("id")
    .single();

  /* ---------------------------------------------------- owner: send it */
  await page.goto(`${BASE}/dashboard/clients/${client.id}`, { waitUntil: "networkidle" });
  await page.getByText("שליחת שאלון").click();
  await page.selectOption('select[name="formId"]', form.id);
  await page.getByRole("button", { name: "הכנת קישור" }).click();
  // Two such links can now exist: the send-questionnaire panel's own, and the
  // one Finding A added to the (now-visible) unanswered card above it. This
  // test is about the send panel's own link, which sits last in DOM order.
  await page.waitForSelector('a:has-text("שליחה בוואטסאפ")', { timeout: 20000 });

  const { data: request } = await admin
    .from("intake_requests")
    .select("id, public_token, questions, form_name, answers, submitted_at")
    .eq("client_id", client.id)
    .single();

  check("a request row was created", Boolean(request));
  check(
    "the token is 32 lowercase hex characters",
    /^[0-9a-f]{32}$/.test(request?.public_token ?? ""),
    request?.public_token ?? "null",
  );
  check(
    "the questions were snapshotted onto the request",
    request?.questions?.length === 2,
    String(request?.questions?.length),
  );
  check("the form name was snapshotted", request?.form_name === "שאלון בדיקה");
  check("nothing is answered yet", request?.answers === null);

  const waHref = await page.locator('a:has-text("שליחה בוואטסאפ")').last().getAttribute("href");
  check(
    "the WhatsApp link carries the token and the right recipient",
    waHref.includes(request.public_token) && waHref.startsWith("https://wa.me/972541234567"),
  );

  /* --------------------------------------- editing the form does not leak */
  await admin.from("intake_forms").update({ name: "שם אחר", questions: [] }).eq("id", form.id);
  const { data: afterEdit } = await admin
    .from("intake_requests")
    .select("form_name, questions")
    .eq("id", request.id)
    .single();
  check(
    "editing the saved form does not change a link already sent",
    afterEdit.form_name === "שאלון בדיקה" && afterEdit.questions.length === 2,
  );

  /* ------------------------------------------------ the anonymous client */
  const anon = await browser.newContext({ viewport: { width: 390, height: 850 } });
  await anon.addInitScript(hidePortal);
  const client_page = await anon.newPage();
  const url = `${BASE}/f/${request.public_token}`;
  await client_page.goto(url, { waitUntil: "networkidle" });

  check(
    "an anonymous visitor sees the questions",
    (await client_page.locator("fieldset").count()) === 2,
  );
  check(
    "the page is noindex",
    /noindex/.test(await client_page.content()),
  );
  check(
    "the client's name is not on the page",
    !(await client_page.locator("body").innerText()).includes("דנה"),
  );

  const headRes = await fetch(url, { redirect: "manual" });
  check(
    "the token is not leaked in a Referer",
    headRes.headers.get("referrer-policy") === "no-referrer",
    headRes.headers.get("referrer-policy") ?? "missing",
  );
  check(
    "there is a CSP on it",
    Boolean(headRes.headers.get("content-security-policy")),
  );

  const robotsText = await (await fetch(`${BASE}/robots.txt`)).text();
  check("robots.txt disallows /f/", robotsText.includes("Disallow: /f/"));

  /* ---------------------------------------------------------- answer it */
  await client_page.getByRole("radio", { name: "2", exact: true }).check();
  await client_page.locator('textarea[name="text-1"]').fill("שלושה על ארבעה מטר");
  await client_page.getByRole("button", { name: "שליחת התשובות" }).click();
  await client_page.waitForSelector("text=תודה", { timeout: 20000 });

  const { data: answered } = await admin
    .from("intake_requests")
    .select("answers, submitted_at")
    .eq("id", request.id)
    .single();

  check("the answers landed", answered.answers !== null);
  check(
    "they are keyed by question id",
    answered.answers?.floor_elevator === "2" &&
      answered.answers?.["text-1"] === "שלושה על ארבעה מטר",
    JSON.stringify(answered.answers),
  );
  check("submitted_at was set", Boolean(answered.submitted_at));

  /* ----------------------------------------------- a second one is refused */
  await client_page.goto(url, { waitUntil: "networkidle" });
  check(
    "a second visit shows the answered state, not an empty form",
    (await client_page.locator("fieldset").count()) === 0 &&
      (await client_page.locator("body").innerText()).includes("כבר ענית"),
  );

  const { data: replay } = await admin.rpc("submit_intake_request", {
    p_token: request.public_token,
    p_answers: { floor_elevator: "4", "text-1": "overwritten" },
  });
  check("a replayed submission is refused by the database", replay === "unchanged", String(replay));

  const { data: intact } = await admin
    .from("intake_requests")
    .select("answers")
    .eq("id", request.id)
    .single();
  check(
    "the original answers were not overwritten",
    intact.answers?.floor_elevator === "2",
  );

  /* ------------------------------------------------------ an unknown token */
  const missing = await fetch(`${BASE}/f/${"a".repeat(32)}`, { redirect: "manual" });
  check("an unknown token is a 404", missing.status === 404, String(missing.status));
  const missingBody = await missing.text();
  check(
    "an unknown token's 404 is still noindex",
    /noindex/.test(missingBody),
  );
  const malformed = await fetch(`${BASE}/f/not-a-token`, { redirect: "manual" });
  check("a malformed token is a 404", malformed.status === 404, String(malformed.status));
  const malformedBody = await malformed.text();
  check(
    "a malformed token's 404 is still noindex",
    /noindex/.test(malformedBody),
  );

  await browser.close();
}

try {
  console.log(`\nIntake questionnaire against ${BASE}\n`);
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
