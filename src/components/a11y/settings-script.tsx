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

export function A11ySettingsScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
