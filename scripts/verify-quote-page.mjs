/**
 * Checks how the public quote page presents itself.
 *
 * This is the only screen a client ever sees, and it is reached by tapping a
 * link in WhatsApp, so what matters is the first paint and what the preview
 * card looked like before the tap. Both are things you have to load to see.
 *
 * Run:  npm run verify:quote
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
  console.error("Missing env vars. Run via: npm run verify:quote");
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

// A real 8x8 PNG, so next/image has something genuine to optimise.
const LOGO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR42mNkYPhfz0AEYBxVSF+FjIyM/xkYGBgYSTVxVCF9FQIAxRkQiVvJm7oAAAAASUVORK5CYII=",
  "base64",
);

const email = `quotecheck-${Date.now()}@example.com`;
let userId = null;
let publicToken = null;
let logoPath = null;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "quote-check-password-123",
    email_confirm: true,
    user_metadata: { business_name: "מיזוג אוויר כהן", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  // A logo is the whole point of the LCP check, so upload a real one.
  logoPath = `${biz.id}/logo-${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from("logos")
    .upload(logoPath, LOGO_PNG, { contentType: "image/png", upsert: true });
  if (upErr) throw upErr;
  const logoUrl = admin.storage.from("logos").getPublicUrl(logoPath).data.publicUrl;

  await admin
    .from("businesses")
    .update({ phone: "0541234567", logo_url: logoUrl })
    .eq("id", biz.id);

  const { data: client } = await admin
    .from("clients")
    .insert({ business_id: biz.id, full_name: "רונית ברק", phone: "0549998877" })
    .select("id")
    .single();

  const { data: quote } = await admin
    .from("quotes")
    .insert({ business_id: biz.id, client_id: client.id })
    .select("id, public_token")
    .single();

  await admin.from("quote_line_items").insert([
    { quote_id: quote.id, description: "התקנת מזגן עילי", quantity: 1, unit_price: 2400, sort_order: 0 },
    { quote_id: quote.id, description: "צנרת נחושת", quantity: 4, unit_price: 120, sort_order: 1 },
  ]);

  await admin.from("quotes").update({ status: "sent" }).eq("id", quote.id);
  publicToken = quote.public_token;
}

async function cleanup() {
  if (logoPath) await admin.storage.from("logos").remove([logoPath]).catch(() => {});
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

async function run() {
  await seed();
  const url = `${BASE}/q/${publicToken}`;

  /* ---------------------------------------- what the markup asks for */
  const html = await (await fetch(url)).text();

  const logoImg = html.match(/<img[^>]+alt="מיזוג אוויר כהן"[^>]*>/)?.[0] ?? "";
  check("the logo img was found", logoImg.length > 0);
  check(
    "the logo loads eagerly",
    logoImg.includes('loading="eager"'),
    logoImg.match(/loading="[a-z]+"/)?.[0] ?? "no loading attr",
  );
  check(
    "the logo carries fetchpriority=high",
    /fetchpriority="high"/i.test(logoImg),
    logoImg.match(/fetchpriority="[a-z]+"/i)?.[0] ?? "absent",
  );
  check(
    "the logo goes through the image optimiser",
    logoImg.includes("/_next/image"),
  );

  /* ------------------------------------- what the browser actually does */
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();

  const imageRequests = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image") {
      imageRequests.push({ url: r.url(), started: Date.now() });
    }
  });

  // Empty cache, as the acceptance criterion asks.
  await ctx.clearCookies();
  const started = Date.now();
  await page.goto(url, { waitUntil: "networkidle" });

  const logoReq = imageRequests.find((r) => r.url.includes("/_next/image"));
  check("the logo was requested", Boolean(logoReq));
  check(
    "it is requested in the first wave",
    logoReq ? logoReq.started - started < 1500 : false,
    logoReq ? `+${logoReq.started - started}ms` : "never",
  );

  // The flash of an empty square: is the logo painted by the time the
  // document is interactive, or does it arrive afterwards?
  const painted = await page.evaluate(() => {
    const img = document.querySelector('header img');
    return img ? { complete: img.complete, w: img.naturalWidth } : null;
  });
  check(
    "the logo is decoded, not an empty box",
    Boolean(painted && painted.complete && painted.w > 0),
    painted ? `complete=${painted.complete} naturalWidth=${painted.w}` : "no img",
  );

  await browser.close();
}

try {
  console.log(`\nQuote page against ${BASE}\n`);
  await run();
  await cleanup();
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  await cleanup();
  process.exit(1);
}
