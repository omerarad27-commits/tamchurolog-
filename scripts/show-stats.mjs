/**
 * Prints the raw quote rows for an account next to the numbers the stats page
 * computes from them, so the two can be compared by hand.
 *
 *   npm run stats -- you@example.com
 *
 * Output is English on purpose — Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

import { computeQuoteStats } from "../src/lib/stats.ts";

const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!email) {
  console.error("Usage: npm run stats -- you@example.com");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account for ${email}`);
  process.exit(1);
}

const { data: business } = await admin
  .from("businesses")
  .select("id, name")
  .eq("owner_user_id", user.id)
  .single();

const { data: quotes } = await admin
  .from("quotes")
  .select("quote_number, status, sent_at, decided_at, total")
  .eq("business_id", business.id)
  .order("quote_number");

const hours = (from, to) =>
  from && to ? (new Date(to) - new Date(from)) / 3600000 : null;

console.log(`\nBusiness: ${business.name}\n`);
console.log("  #    status     sent?  decided?  hours   total");
console.log("  ---  ---------  -----  --------  ------  ----------");
for (const q of quotes) {
  const h = hours(q.sent_at, q.decided_at);
  console.log(
    `  ${String(q.quote_number).padEnd(4)} ${q.status.padEnd(10)} ` +
      `${(q.sent_at ? "yes" : "no").padEnd(6)} ` +
      `${(q.decided_at ? "yes" : "no").padEnd(9)} ` +
      `${(h === null ? "-" : h.toFixed(1)).padEnd(7)} ` +
      `${Number(q.total).toFixed(2)}`,
  );
}

const stats = computeQuoteStats(quotes);

console.log("\nWork it out by hand:");
console.log(`  rows with sent_at              = ${stats.sent}`);
console.log(`  approved                       = ${stats.approved}`);
console.log(`  declined                       = ${stats.declined}`);
console.log(`  close rate = ${stats.approved}/${stats.decided}` +
  `${stats.decided === 0 ? " -> undefined" : ` = ${(stats.closeRate * 100).toFixed(1)}%`}`);
console.log(`  rows counted in the average    = ${stats.averageDecisionSample}`);
console.log(
  `  average hours                  = ${
    stats.averageDecisionHours === null ? "-" : stats.averageDecisionHours.toFixed(2)
  }`,
);

console.log(`  sum of approved totals         = ${stats.approvedValue.toFixed(2)}`);
console.log(`  sum of sent+viewed totals      = ${stats.pendingValue.toFixed(2)}`);

console.log("\nWhat the stats page will show:");
console.log(`  Approved value       ${stats.approvedValue.toFixed(2)}`);
console.log(`  Awaiting a reply     ${stats.pendingValue.toFixed(2)}`);
console.log(`  Quotes sent          ${stats.sent}`);
console.log(
  `  Close rate           ${
    stats.closeRate === null ? "—" : `${Math.round(stats.closeRate * 100)}%`
  }`,
);
console.log(
  `  Avg time to decide   ${
    stats.averageDecisionHours === null
      ? "—"
      : stats.averageDecisionHours < 48
        ? `${Math.round(stats.averageDecisionHours)} hours`
        : `${Math.round((stats.averageDecisionHours / 24) * 10) / 10} days`
  }`,
);
console.log("  By status:");
for (const [status, count] of Object.entries(stats.byStatus)) {
  console.log(`    ${status.padEnd(10)} ${count}`);
}
console.log(`    ${"total".padEnd(10)} ${stats.total}`);
