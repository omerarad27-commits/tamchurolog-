/**
 * Checks the crawler-facing files.
 *
 * The stakes here are asymmetric: a missing sitemap costs a little traffic,
 * while a /q path that becomes crawlable publishes somebody's quote. So the
 * disallow and the absence of /q from the sitemap are asserted first.
 *
 * Run:  npm run verify:seo
 *       npm run verify:seo -- --url https://tamchurolog.vercel.app
 */

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const BASE = urlFlag !== -1 ? args[urlFlag + 1] : "http://localhost:3100";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  [${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
}

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, type: res.headers.get("content-type") ?? "", res };
};

console.log(`\nSEO surface against ${BASE}\n`);

/* ------------------------------------------------------------ robots */
const robots = await get("/robots.txt");
check("robots.txt responds 200", robots.status === 200, String(robots.status));
const robotsBody = await robots.res.text();
check("it disallows /q/", /Disallow:\s*\/q\//.test(robotsBody));
check("it disallows /dashboard/", /Disallow:\s*\/dashboard\//.test(robotsBody));
check("it allows the landing page", /Allow:\s*\/\s*$/m.test(robotsBody));
check("it points at the sitemap", /Sitemap:\s*https?:\/\/\S+/.test(robotsBody));

/* ----------------------------------------------------------- sitemap */
const sitemap = await get("/sitemap.xml");
check("sitemap.xml responds 200", sitemap.status === 200, String(sitemap.status));
check("it is XML", sitemap.type.includes("xml"), sitemap.type);
const sitemapBody = await sitemap.res.text();
const locs = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("it lists exactly one URL", locs.length === 1, locs.join(" "));
check("no /q token is published", !sitemapBody.includes("/q/"));
check(
  "the URL is absolute and not a preview host",
  locs[0]?.startsWith("http") && !locs[0].includes("vercel.app/_"),
  locs[0] ?? "none",
);

/* ---------------------------------------------------------- manifest */
const manifest = await get("/manifest.webmanifest");
check("the manifest responds 200", manifest.status === 200, String(manifest.status));
const m = await manifest.res.json();
check("it has a name and short_name", Boolean(m.name && m.short_name));
check("it is standalone", m.display === "standalone", m.display ?? "");
check("it declares Hebrew RTL", m.lang === "he" && m.dir === "rtl");
check("it lists icons", Array.isArray(m.icons) && m.icons.length > 0);

for (const icon of m.icons ?? []) {
  const r = await get(icon.src);
  check(
    `manifest icon ${icon.src} resolves`,
    r.status === 200 && r.type.includes("png"),
    `${r.status} ${r.type}`,
  );
}

/* ------------------------------------------------- icons and canonical */
for (const path of ["/icon", "/apple-icon"]) {
  const r = await get(path);
  const bytes = Buffer.from(await r.res.arrayBuffer());
  check(
    `${path} is a real PNG`,
    r.status === 200 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    `${r.status} ${bytes.length}b`,
  );
}

const home = await (await fetch(BASE)).text();
const canonical = home.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
check("the landing page has a canonical", Boolean(canonical), canonical ?? "absent");
check(
  "the canonical is absolute",
  Boolean(canonical?.startsWith("http")),
  canonical ?? "",
);
check(
  "apple-touch-icon is linked for add-to-home-screen",
  /rel="apple-touch-icon"/.test(home),
);
check("the manifest is linked", /rel="manifest"/.test(home));

const failed = results.filter((r) => !r.passed).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
