/**
 * Responsive screenshot harness.
 *
 * Creates a throwaway business with seeded quotes, signs in as it, and shoots
 * every screen at phone, tablet and desktop. Deletes the account at the end.
 *
 * Run:  npm run shoot            (assumes a dev server on :3000)
 *       npm run shoot -- --url https://tamchurolog.vercel.app
 *
 * Output lands in .screenshots/ (gitignored).
 *
 * English output on purpose - Windows terminals mangle Hebrew.
 */

import { mkdir, rm } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3000";
const OUT = ".screenshots";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run shoot");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VIEWPORTS = [
  { name: "375-phone", width: 375, height: 812 },
  { name: "768-tablet", width: 768, height: 1024 },
  // Not one of the three the brief names. It is where a two-column grid is
  // narrowest while still being two columns, so it is where one breaks.
  { name: "1024-laptop", width: 1024, height: 768 },
  { name: "1440-desktop", width: 1440, height: 900 },
];

const stamp = Date.now();
const email = `shoot-${stamp}@example.com`;
const PASSWORD = "shoot-harness-password-123";

let userId = null;
let publicToken = null;

/** Enough rows that a two-column grid and a filter bar both have work to do. */
const SEED = [
  { name: "דוד כהן", phone: "0541112233", status: "viewed", items: [["התקנת דוד שמש", 1, 2340]] },
  { name: "רונית לוי", phone: "0542223344", status: "approved", items: [["פתיחת סתימה", 1, 890]] },
  { name: "משה אבני", phone: "0543334455", status: "draft", items: [["שיפוץ אמבטיה", 1, 4200], ["חומרים", 1, 900]] },
  { name: "יעל ברק", phone: "0544445566", status: "declined", items: [["החלפת צנרת", 12, 101.67]] },
  { name: "אבי מזרחי", phone: "0545556677", status: "sent", items: [["בדיקת לחץ מים", 2, 275]] },
  { name: "נועה שלו", phone: "0546667788", status: "viewed", items: [["התקנת ברז מטבח", 1, 640]] },
];

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "אינסטלציה כהן ובניו", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  await admin
    .from("businesses")
    .update({ phone: "0541234567", vat_rate: 0.18 })
    .eq("id", biz.id);

  for (const row of SEED) {
    const { data: client } = await admin
      .from("clients")
      .insert({ business_id: biz.id, full_name: row.name, phone: row.phone })
      .select("id")
      .single();

    const sentAt =
      row.status === "draft"
        ? null
        : new Date(Date.now() - 6 * 86400000).toISOString();

    /*
     * Always born a draft, priced, and only then moved to its real status.
     * A decided quote is frozen at the row level, so inserting line items
     * afterwards is refused by the database and the total stays at zero. The
     * first run of this harness produced two quotes worth 0 for exactly that
     * reason, which is the freeze trigger doing its job.
     */
    const { data: quote } = await admin
      .from("quotes")
      .insert({
        business_id: biz.id,
        client_id: client.id,
        notes: row.status === "draft" ? "התשלום בשני תשלומים שווים. אחריות שנתיים על העבודה." : null,
      })
      .select("id, public_token")
      .single();

    if (!publicToken) publicToken = quote.public_token;

    await admin.from("quote_line_items").insert(
      row.items.map(([description, quantity, unitPrice], index) => ({
        quote_id: quote.id,
        description,
        quantity,
        unit_price: unitPrice,
        sort_order: index,
      })),
    );

    if (row.status !== "draft") {
      await admin
        .from("quotes")
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", quote.id);
    }

    if (row.status === "viewed") {
      await admin.rpc("record_quote_view", {
        p_token: quote.public_token,
        p_ip_address: "203.0.113.20",
        p_user_agent: "Mozilla/5.0 (iPhone) Safari",
      });
    }

    if (row.status === "declined") {
      await admin.rpc("record_quote_decision", {
        p_token: quote.public_token,
        p_decision: "declined",
        p_signature_name: "",
        p_ip: "203.0.113.30",
        p_reason: "מצאתי הצעה זולה יותר",
      });
    }

    if (row.status === "approved") {
      await admin.rpc("record_quote_decision", {
        p_token: quote.public_token,
        p_decision: "approved",
        p_signature_name: row.name,
        p_ip: "203.0.113.10",
        p_reason: "",
      });
    }
  }

  console.log(`  seeded ${SEED.length} quotes for ${email}`);
}

const SCREENS = [
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "stats", path: "/dashboard/stats", auth: true },
  { name: "clients", path: "/dashboard/clients", auth: true },
  { name: "settings", path: "/dashboard/settings", auth: true },
  { name: "quote-new", path: "/dashboard/quotes/new", auth: true },
  { name: "public-quote", path: () => `/q/${publicToken}`, auth: false },
];

async function shoot() {
  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      locale: "he-IL",
    });
    const page = await context.newPage();

    // One sign-in per context; the session cookie carries the rest.
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });

    // The dev-mode Next.js badge sits over the bottom-left corner, which is
    // exactly where the mobile tab bar needs looking at.
    await page.addStyleTag({
      content: "nextjs-portal, #__next-build-watcher { display: none !important; }",
    });

    for (const screen of SCREENS) {
      const path = typeof screen.path === "function" ? screen.path() : screen.path;
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content: "nextjs-portal, #__next-build-watcher { display: none !important; }",
      });
      // Let the webfont settle so the shot is not of the fallback face.
      await page.evaluate(() => document.fonts.ready);

      // Two shots per screen. Full page shows the composition; the viewport
      // shot is the only one that renders a sticky bar where it really sits.
      await page.screenshot({
        path: `${OUT}/${screen.name}--${viewport.name}--full.png`,
        fullPage: true,
      });
      await page.screenshot({
        path: `${OUT}/${screen.name}--${viewport.name}--view.png`,
      });
    }

    console.log(`  shot ${SCREENS.length} screens at ${viewport.width}px`);
    await context.close();
  }

  await browser.close();
}

async function cleanup() {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

try {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await seed();
  await shoot();
  await cleanup();
  console.log(`\ndone - ${OUT}/`);
} catch (err) {
  console.error("\nERROR:", err.message);
  await cleanup();
  process.exit(1);
}
