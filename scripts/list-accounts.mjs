/**
 * Lists the accounts in this Supabase project and whether each has a business
 * row. Handy when a seed or verify script says it cannot find an account.
 *
 *   npm run accounts
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: businesses } = await admin
  .from("businesses")
  .select("id, owner_user_id, name");

console.log(`users: ${data.users.length}\n`);
for (const user of data.users) {
  const business = businesses?.find((b) => b.owner_user_id === user.id);
  const label = business
    ? `business: yes  name=${JSON.stringify(business.name)}`
    : "business: NONE";
  console.log(`  ${(user.email ?? "(no email)").padEnd(34)} ${label}`);
}
