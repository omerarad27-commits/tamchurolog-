/**
 * Measures real layout shift on the dashboard screens.
 *
 * A skeleton that looks right in a still frame can still shift the page when
 * the real content lands. This throttles the network so the loading state is
 * actually on screen, then records every layout-shift entry the browser
 * reports and sums them the way Core Web Vitals does.
 *
 * Run:  npm run cls
 *
 * Anything at or under 0.1 is Google's "good" threshold. English output on
 * purpose - Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars. Run via: npm run cls");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const email = `cls-${stamp}@example.com`;
const PASSWORD = "cls-harness-password-123";
let userId = null;

async function seed() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: "בדיקת קפיצות", business_type: "licensed" },
  });
  if (error) throw error;
  userId = created.user.id;

  const { data: biz } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  for (let i = 0; i < 6; i += 1) {
    const { data: client } = await admin
      .from("clients")
      .insert({ business_id: biz.id, full_name: `לקוח מספר ${i + 1}`, phone: "0541234567" })
      .select("id")
      .single();

    const { data: quote } = await admin
      .from("quotes")
      .insert({ business_id: biz.id, client_id: client.id })
      .select("id")
      .single();

    await admin.from("quote_line_items").insert({
      quote_id: quote.id,
      description: "עבודה",
      quantity: 1,
      unit_price: 500 + i * 130,
      sort_order: 0,
    });

    await admin
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", quote.id);
  }
}

/*
 * Navigated by clicking, not by goto.
 *
 * loading.tsx is what the router shows while it fetches the next route's
 * payload, which only happens on a soft navigation. A hard page load streams
 * the real content and the skeleton is never painted, so driving this with
 * goto measures a screen the skeleton had no part in and reports a clean zero
 * for every case, passing and failing alike.
 */
const SCREENS = [
  { name: "clients", link: "לקוחות", url: "**/dashboard/clients" },
  { name: "stats", link: "סיכום", url: "**/dashboard/stats" },
  { name: "settings", link: "הגדרות", url: "**/dashboard/settings" },
  { name: "quotes", link: "הצעות", url: "**/dashboard" },
];

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1440", width: 1440, height: 900 },
];

async function run() {
  const browser = await chromium.launch();
  const results = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "he-IL",
    });
    /*
     * The observer has to be installed by an init script, not by evaluate().
     * Setting it up and then navigating destroys it with the old document, and
     * every page then reports a perfect zero because nothing was watching.
     */
    await context.addInitScript(() => {
      // The dev overlay portal sits over the whole viewport and swallows the
      // clicks this harness navigates with.
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent =
          "nextjs-portal{display:none!important;pointer-events:none!important}";
        document.head.appendChild(style);
      });

      window.__shift = 0;
      window.__entries = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__shift += entry.value;
            window.__entries.push(Number(entry.value.toFixed(4)));
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });

    // Slow the server responses so the loading state is genuinely rendered
    // rather than skipped on a fast local connection.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });

    for (const screen of SCREENS) {
      // Reset the running total between routes without reloading, so each
      // number belongs to one navigation.
      await page.evaluate(() => {
        window.__shift = 0;
        window.__entries = [];
      });

      await page.getByRole("link", { name: screen.link, exact: true }).click();
      await page.waitForURL(screen.url, { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      // Layout-shift entries are reported a frame late.
      await page.waitForTimeout(400);

      const { shift, entries } = await page.evaluate(() => ({
        shift: window.__shift ?? 0,
        entries: window.__entries ?? [],
      }));

      results.push({
        screen: screen.name,
        viewport: viewport.name,
        shift: Number(shift.toFixed(4)),
        entries: entries.length,
      });
    }

    await context.close();
  }

  await browser.close();
  return results;
}

async function cleanup() {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

try {
  await seed();
  const results = await run();
  await cleanup();

  console.log("\n  screen      width   CLS      shifts  verdict");
  console.log("  " + "-".repeat(48));
  let worst = 0;
  for (const r of results) {
    worst = Math.max(worst, r.shift);
    const verdict = r.shift <= 0.1 ? "good" : r.shift <= 0.25 ? "needs work" : "poor";
    console.log(
      `  ${r.screen.padEnd(12)}${r.viewport.padEnd(8)}${String(r.shift).padEnd(9)}${String(r.entries).padEnd(8)}${verdict}`,
    );
  }
  console.log(`\n  worst: ${worst} (threshold for "good" is 0.1)`);
  process.exit(worst <= 0.1 ? 0 : 1);
} catch (err) {
  console.error("\nERROR:", err.message);
  await cleanup();
  process.exit(1);
}
