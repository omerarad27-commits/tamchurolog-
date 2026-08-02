import { headers } from "next/headers";

import { A11Y_STORAGE_KEY } from "@/lib/a11y";

/*
 * A minified copy of applyA11ySettings, run before the first paint.
 *
 * It has to be inline and blocking. The alternative — applying the settings
 * from the widget's effect after hydration — means someone who chose high
 * contrast sees a flash of the ordinary light page on every navigation, which
 * is precisely the visitor least able to absorb it.
 *
 * Same generic walk as the real function, so neither has to know the option
 * list and they cannot drift apart over it.
 */
const SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  A11Y_STORAGE_KEY,
)})||"{}"),d=document.documentElement;for(var k in s){var v=s[k];if(v&&v!=="normal")d.setAttribute("data-a11y-"+k,v===true?"on":String(v))}}catch(e){}`;

/*
 * The nonce is not optional here. The app serves a
 * `script-src 'self' 'nonce-…' 'strict-dynamic'` policy, which is exactly the
 * policy that exists to stop an inline script the server did not author — and
 * it stopped this one. The symptom was quiet: the setting was in localStorage,
 * the attribute was never on <html>, and nothing failed out loud.
 *
 * proxy.ts mints the nonce per request and passes it through as x-nonce.
 *
 * suppressHydrationWarning is required, and is not papering over a real
 * mismatch. Browsers deliberately hide the nonce attribute from the DOM once
 * the CSP has been applied — `script.getAttribute("nonce")` returns "" by
 * design, so that a script injected into the page cannot read a valid nonce and
 * reuse it. React compares the server's markup against that emptied attribute,
 * finds a difference it cannot explain, and reports a mismatch on every page in
 * the app.
 *
 * The cost of leaving it was not only noise: React abandons attribute patching
 * for the whole tree when this fires, so genuine mismatches downstream went
 * unreported too, and any real one would have been buried in the same warning.
 */
export async function A11ySettingsScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
