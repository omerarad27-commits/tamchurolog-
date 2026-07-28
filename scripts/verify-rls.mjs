/**
 * Proves that Row Level Security isolates tenants.
 *
 * Creates two throwaway business owners, signs in as A with the anon key, and
 * tries every way A could reach B's data. Deletes both users at the end.
 *
 * Run:  npm run verify:rls
 *
 * Output is English on purpose — Windows terminals mangle Hebrew.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env vars. Run via: npm run verify:rls");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const stamp = Date.now();
const PASSWORD = "rls-check-password-123";
const owners = {
  a: { email: `rls-check-a-${stamp}@example.com`, id: null, businessId: null },
  b: { email: `rls-check-b-${stamp}@example.com`, id: null, businessId: null },
};

async function createOwner(owner, businessName) {
  const { data, error } = await admin.auth.admin.createUser({
    email: owner.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { business_name: businessName },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  owner.id = data.user.id;

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id, name")
    .eq("owner_user_id", owner.id)
    .single();
  if (businessError) {
    throw new Error(`business row missing after signup: ${businessError.message}`);
  }
  owner.businessId = business.id;
  return business;
}

async function cleanup() {
  for (const owner of Object.values(owners)) {
    if (owner.id) await admin.auth.admin.deleteUser(owner.id);
  }
}

async function main() {
  console.log("\nSetting up two throwaway business owners...");
  const businessA = await createOwner(owners.a, "Business A");
  await createOwner(owners.b, "Business B");
  console.log(`  owner A: ${owners.a.email}`);
  console.log(`  owner B: ${owners.b.email}`);

  console.log("\n1. Signup trigger");
  check(
    "each new user automatically gets exactly one business row",
    Boolean(owners.a.businessId && owners.b.businessId) &&
      owners.a.businessId !== owners.b.businessId,
  );
  check(
    "business name comes from the signup form",
    businessA.name === "Business A",
    `got "${businessA.name}"`,
  );

  // Seed one client for each owner, using the service key so the seeding itself
  // is not what is being tested.
  await admin.from("clients").insert([
    { business_id: owners.a.businessId, full_name: "Client of A", phone: "0501111111" },
    { business_id: owners.b.businessId, full_name: "Client of B", phone: "0502222222" },
  ]);

  console.log("\n2. Anonymous visitor (no session)");
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonBusinesses = await anonClient.from("businesses").select("id");
  const anonClients = await anonClient.from("clients").select("id");
  check(
    "cannot read any business",
    (anonBusinesses.data ?? []).length === 0,
    `rows returned: ${(anonBusinesses.data ?? []).length}`,
  );
  check(
    "cannot read any client",
    (anonClients.data ?? []).length === 0,
    `rows returned: ${(anonClients.data ?? []).length}`,
  );

  console.log("\n3. Owner A signed in, reaching for B's data");
  const asA = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await asA.auth.signInWithPassword({
    email: owners.a.email,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`sign in failed: ${signInError.message}`);

  const ownBusinesses = await asA.from("businesses").select("id, name");
  check(
    "sees only its own business",
    (ownBusinesses.data ?? []).length === 1 &&
      ownBusinesses.data[0].id === owners.a.businessId,
    `rows returned: ${(ownBusinesses.data ?? []).length}`,
  );

  const targetedBusiness = await asA
    .from("businesses")
    .select("id, name")
    .eq("id", owners.b.businessId);
  check(
    "querying B's business by its exact id returns nothing",
    (targetedBusiness.data ?? []).length === 0,
    `rows returned: ${(targetedBusiness.data ?? []).length}`,
  );

  const allClients = await asA.from("clients").select("id, full_name");
  check(
    "sees only its own clients",
    (allClients.data ?? []).length === 1 &&
      allClients.data[0].full_name === "Client of A",
    `rows returned: ${(allClients.data ?? []).length}`,
  );

  const targetedClients = await asA
    .from("clients")
    .select("id, full_name")
    .eq("business_id", owners.b.businessId);
  check(
    "querying B's clients by B's business_id returns nothing",
    (targetedClients.data ?? []).length === 0,
    `rows returned: ${(targetedClients.data ?? []).length}`,
  );

  console.log("\n4. Owner A trying to write into B's data");
  const forgedInsert = await asA
    .from("clients")
    .insert({ business_id: owners.b.businessId, full_name: "Injected by A" })
    .select();
  check(
    "cannot insert a client into B's business",
    Boolean(forgedInsert.error),
    forgedInsert.error ? forgedInsert.error.code : "insert unexpectedly succeeded",
  );

  const forgedUpdate = await asA
    .from("businesses")
    .update({ name: "Hijacked by A" })
    .eq("id", owners.b.businessId)
    .select();
  check(
    "cannot rename B's business",
    (forgedUpdate.data ?? []).length === 0,
    `rows updated: ${(forgedUpdate.data ?? []).length}`,
  );

  const ownInsert = await asA
    .from("clients")
    .insert({ business_id: owners.a.businessId, full_name: "Legitimate client" })
    .select();
  check(
    "can still insert into its OWN business (policies are not just blanket denies)",
    !ownInsert.error && (ownInsert.data ?? []).length === 1,
    ownInsert.error ? ownInsert.error.message : "",
  );

  // Confirm B's row was never touched.
  const { data: bAfter } = await admin
    .from("businesses")
    .select("name")
    .eq("id", owners.b.businessId)
    .single();
  check(
    "B's business row is unchanged after all of A's attempts",
    bAfter?.name === "Business B",
    `name is now "${bAfter?.name}"`,
  );

  console.log("\n5. Logo storage isolation");
  // A 1x1 PNG is enough to exercise the storage policies.
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const pngBlob = new Blob([pngBytes], { type: "image/png" });

  const ownUpload = await asA.storage
    .from("logos")
    .upload(`${owners.a.businessId}/logo-test.png`, pngBlob, {
      contentType: "image/png",
      upsert: true,
    });
  check(
    "can upload a logo into its own folder",
    !ownUpload.error,
    ownUpload.error ? ownUpload.error.message : "",
  );

  const forgedUpload = await asA.storage
    .from("logos")
    .upload(`${owners.b.businessId}/logo-test.png`, pngBlob, {
      contentType: "image/png",
      upsert: true,
    });
  check(
    "cannot upload a logo into B's folder",
    Boolean(forgedUpload.error),
    forgedUpload.error ? forgedUpload.error.message : "upload unexpectedly succeeded",
  );

  await admin.storage
    .from("logos")
    .remove([`${owners.a.businessId}/logo-test.png`]);
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  console.error(`\nERROR: ${error.message}`);
  exitCode = 1;
} finally {
  await cleanup();
  console.log("\nCleaned up both test users.");
}

const failed = results.filter((r) => !r.passed);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed.`,
);
if (failed.length > 0) {
  console.log("Failed checks:");
  for (const f of failed) console.log(`  - ${f.name}`);
  exitCode = 1;
}
process.exit(exitCode);
