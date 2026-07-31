/**
 * Unit checks for the contact links on the client hub.
 *
 * A wrong tel: or wa.me number does not throw. It silently opens a call or a
 * chat with the wrong person, which is exactly the kind of failure that needs
 * a test rather than a glance.
 *
 * Run:  npm run verify:contact
 */

import { normalizeIsraeliPhone } from "../src/lib/phone.ts";
import { buildWhatsAppChatUrl } from "../src/lib/whatsapp.ts";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

console.log("\nContact links\n");

const local = buildWhatsAppChatUrl("054-123-4567");
check(
  "a local number becomes an international wa.me link",
  local.url === "https://wa.me/972541234567",
  local.url,
);
check("it reports having a recipient", local.hasRecipient === true);
check("no message is prefilled", !local.url.includes("text="), local.url);

// Same number written four ways must produce one link.
const spellings = ["0541234567", "054-123-4567", "+972-54-123-4567", "972541234567"];
check(
  "every spelling of the number gives the same link",
  new Set(spellings.map((s) => buildWhatsAppChatUrl(s).url)).size === 1,
  spellings.map((s) => buildWhatsAppChatUrl(s).url).join(" | "),
);

const none = buildWhatsAppChatUrl(null);
check(
  "a missing number still opens WhatsApp",
  none.url.startsWith("https://wa.me/"),
  none.url,
);
check("but it reports no recipient", none.hasRecipient === false);

const junk = buildWhatsAppChatUrl("not a phone");
check(
  "an invalid number never becomes a recipient",
  junk.hasRecipient === false && !/\d/.test(junk.url),
  junk.url,
);

check(
  "tel: uses E.164",
  normalizeIsraeliPhone("054-123-4567")?.e164 === "+972541234567",
  normalizeIsraeliPhone("054-123-4567")?.e164 ?? "null",
);
check(
  "an unusable number has no tel: at all",
  normalizeIsraeliPhone("not a phone") === null,
);

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
