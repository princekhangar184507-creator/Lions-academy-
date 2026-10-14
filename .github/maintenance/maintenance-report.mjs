import { writeFile } from "node:fs/promises";

const BASE = "https://princekhangar184507-creator.github.io/Lions-academy-";
const checks = [];
const add = (name, ok, details = "") => checks.push({ name, ok: Boolean(ok), details });

async function getText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "LionsAcademy-MaintenanceScanner/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  return { response, text: await response.text() };
}

try {
  const { response, text: html } = await getText(BASE + "/");
  add("Homepage responds successfully", response.ok, `HTTP ${response.status}`);
  add("HTML content type", (response.headers.get("content-type") || "").includes("text/html"), response.headers.get("content-type") || "No content-type header");
  add("Page title exists", /<title[^>]*>\s*[^<]+\s*<\/title>/i.test(html));
  add("Meta description exists", /<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["']/i.test(html));
  add("Canonical URL exists", /<link\s+[^>]*rel=["']canonical["'][^>]*href=["'][^"']+["']/i.test(html));
  add("Structured data exists", /type=["']application\/ld\+json["']/i.test(html));
  add("Social preview card exists", /name=["']twitter:card["']/i.test(html));
  add("H1 heading exists", /<h1\b/i.test(html));

  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const missingAlt = imageTags.filter((tag) => !/\balt\s*=/i.test(tag));
  add("Images have alt attributes", missingAlt.length === 0, missingAlt.length ? `${missingAlt.length} image(s) missing alt` : `${imageTags.length} images checked`);

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  add("No duplicate HTML IDs", duplicateIds.length === 0, duplicateIds.join(", "));

  const fragments = [...html.matchAll(/href=["']#([^"']+)["']/gi)].map((match) => match[1]);
  const missingFragments = [...new Set(fragments.filter((fragment) => !ids.includes(fragment)))];
  add("In-page links have matching targets", missingFragments.length === 0, missingFragments.join(", "));

  const blankTargets = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].map((match) => match[0]);
  const unsafeTargets = blankTargets.filter((tag) => !/\brel=["'][^"']*\bnoopener\b/i.test(tag));
  add("New-tab links use noopener", unsafeTargets.length === 0, unsafeTargets.length ? `${unsafeTargets.length} link(s) need rel=noopener` : `${blankTargets.length} links checked`);

  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    try {
      const { response: fileResponse, text: fileText } = await getText(BASE + path);
      const valid = fileResponse.ok && fileText.trim().length > 0;
      add(`${path} is available`, valid, `HTTP ${fileResponse.status}`);
    } catch (error) {
      add(`${path} is available`, false, String(error));
    }
  }
} catch (error) {
  add("Homepage scan completed", false, String(error));
}

const failures = checks.filter((check) => !check.ok);
const lines = [
  "# Lions Cricket Academy — Website Maintenance Report",
  "",
  `Scanned: ${new Date().toISOString()}`,
  `Website: ${BASE}/`,
  "",
  `**Result: ${checks.length - failures.length}/${checks.length} checks passed.**`,
  "",
  "| Status | Check | Details |",
  "|---|---|---|",
  ...checks.map((check) => `| ${check.ok ? "PASS" : "FAIL"} | ${check.name.replaceAll("|", "\\|")} | ${(check.details || "—").replaceAll("|", "\\|")} |`),
  "",
  "This report checks basic availability and selected technical SEO/accessibility signals. It does not measure rankings, Core Web Vitals, or verify every external link.",
  "",
];
await writeFile("maintenance-report.md", lines.join("\n"), "utf8");
console.log(lines.join("\n"));
