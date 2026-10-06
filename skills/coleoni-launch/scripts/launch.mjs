#!/usr/bin/env node
/**
 * Coleoni · pre-launch check of a whole site.
 *
 *   node launch.mjs <url | folder> --out <folder> [options]
 *
 * Crawls the site (sitemap first, then links from the home page), opens every
 * page on desktop and phone, and checks what breaks a launch: pages that fail,
 * noindex left on, broken links and images, console errors, mixed content,
 * placeholder text, missing titles and share tags, heavy images, mobile
 * overflow, robots.txt, sitemap, 404, HTTPS, redirects and security headers.
 * Writes report.html (with screenshots), report.md and launch.json.
 * A local folder is served on a temporary port. Uses the system Chrome or Edge.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `
node launch.mjs <url|folder> --out <folder> [options]

  --pages 20          most pages to check (default 20)
  --sitemap <url>     sitemap to read (default: <site>/sitemap.xml, then links from the home page)
  --domain site.com   production domain, when checking a local build or a staging URL
  --no-external       skip checking links to other sites
  --hide "sel,sel"    hide elements in the screenshots (cookie banners, chat bubbles)
  --wait 500          extra wait after each page loads, in ms
`;

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const o = { target: null, out: "launch-report", pages: 20, sitemap: null, domain: null, external: true, hide: [], wait: 500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? "";
    if (!a.startsWith("--")) {
      o.target = a;
      continue;
    }
    switch (a) {
      case "--help":
        console.log(HELP);
        process.exit(0);
      case "--out": o.out = val(); break;
      case "--pages": o.pages = Number(val()); break;
      case "--sitemap": o.sitemap = val(); break;
      case "--domain": o.domain = val(); break;
      case "--no-external": o.external = false; break;
      case "--hide": o.hide = val().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--wait": o.wait = Number(val()); break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!o.target) {
    console.log(HELP);
    process.exit(1);
  }
  return o;
}

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
const clean = (u) => {
  const x = new URL(u);
  x.hash = "";
  return x.href;
};

// ---------------------------------------------------------------- local folder
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json", ".pdf": "application/pdf", ".mp4": "video/mp4" };

function serve(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = normalize(join(root, p));
      if (!file.startsWith(root)) file = root;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
      if (!existsSync(file)) {
        const nf = join(root, "404.html");
        res.writeHead(404, { "content-type": TYPES[".html"] });
        return res.end(existsSync(nf) ? readFileSync(nf) : "Not found");
      }
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

// ---------------------------------------------------------------- browser
async function launch() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    fail("playwright-core is missing. Run `npm install` in the skill folder.");
  }
  const tries = [{ channel: "chrome" }, { channel: "msedge" }];
  if (process.env.CHROME_PATH) tries.unshift({ executablePath: process.env.CHROME_PATH });
  for (const t of tries) {
    try {
      return await chromium.launch(t);
    } catch {}
  }
  fail("Chrome/Edge not found. Set CHROME_PATH to the Chrome executable.");
}

async function get(url, opts = {}) {
  try {
    const r = await fetch(url, { redirect: opts.redirect ?? "follow", headers: { "user-agent": "Mozilla/5.0 (coleoni-launch)", "accept-encoding": "br, gzip", ...(opts.headers ?? {}) }, method: opts.method ?? "GET", signal: AbortSignal.timeout(opts.timeout ?? 15000) });
    const text = opts.body === false ? "" : await r.text().catch(() => "");
    return { status: r.status, headers: r.headers, url: r.url, text, location: r.headers.get("location") };
  } catch (e) {
    return { status: 0, error: e.cause?.code || e.name || "error", headers: new Headers(), text: "" };
  }
}

// ---------------------------------------------------------------- findings
const findings = [];
const REF = new Map(); // page -> first link that leads to it
const add = (level, area, title, detail, page = null) => findings.push({ level, area, title, detail, page });

// ---------------------------------------------------------------- site-level checks
async function siteChecks(base, o, isLocal) {
  const origin = new URL(base).origin;
  // robots.txt
  const robots = await get(`${origin}/robots.txt`);
  if (robots.status !== 200) add("fix", "Site", "robots.txt missing", "Search engines and AI crawlers look for it first. Allow everything and point to the sitemap.");
  else {
    // the group for every crawler (User-agent: *) with a bare "Disallow: /"
    let star = false;
    let blocksAll = false;
    let prevAgent = false;
    for (const raw of robots.text.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const [, key, value] = [m[0], m[1].toLowerCase(), m[2].trim()];
      if (key === "user-agent") {
        star = prevAgent ? star || value === "*" : value === "*";
        prevAgent = true;
        continue;
      }
      prevAgent = false;
      if (star && key === "disallow" && value === "/") blocksAll = true;
    }
    if (blocksAll) add("blocker", "Site", "robots.txt blocks the whole site", "`Disallow: /` for every crawler, usually left over from staging. Nothing will be indexed.");
    else add("ok", "Site", "robots.txt", /sitemap:/i.test(robots.text) ? "allows crawling and points to the sitemap" : "allows crawling");
    if (!/sitemap:/i.test(robots.text)) add("info", "Site", "robots.txt has no Sitemap line", "Add `Sitemap: https://…/sitemap.xml`.");
  }
  // sitemap
  const smUrl = o.sitemap ?? `${origin}/sitemap.xml`;
  const sm = await get(smUrl);
  let locs = [];
  if (sm.status === 200 && /<urlset|<sitemapindex/i.test(sm.text)) {
    locs = [...sm.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    const foreign = locs.filter((l) => {
      try {
        const h = new URL(l).hostname;
        return o.domain ? h.replace(/^www\./, "") !== o.domain.replace(/^www\./, "") : h !== new URL(base).hostname;
      } catch {
        return true;
      }
    });
    if (!isLocal && foreign.length && !o.domain) add("fix", "Site", "Sitemap lists another domain", `${foreign.length} of ${locs.length} URLs, for example ${foreign[0]}. Staging or localhost left in the sitemap.`);
    else add("ok", "Site", "sitemap.xml", `${locs.length} URLs`);
  } else add("fix", "Site", "sitemap.xml missing", "Without it, search engines find pages only through links.");
  // 404
  const nf = await get(`${origin}/this-page-should-not-exist-${Date.now().toString(36)}`);
  if (nf.status === 200) add("fix", "Site", "Missing pages answer 200", "A soft 404: search engines index error pages and broken links look fine. Return status 404.");
  else if (nf.status === 404) add(/<html/i.test(nf.text) && nf.text.length > 400 ? "ok" : "fix", "Site", "404 page", /<html/i.test(nf.text) && nf.text.length > 400 ? "returns 404 with a page of its own" : "returns 404, but with the server's bare error page. Add a page with a way back.");
  if (isLocal) {
    add("info", "Site", "HTTPS, redirects and headers", "Checked on the live domain only. Run again after deploy.");
    return locs;
  }
  // https + redirects
  const u = new URL(base);
  if (u.protocol === "https:") {
    const plain = await get(`http://${u.host}/`, { redirect: "manual", body: false });
    if (plain.status >= 300 && plain.status < 400 && /^https:/i.test(plain.location ?? "")) add("ok", "Site", "HTTP goes to HTTPS", `${plain.status} → ${plain.location}`);
    else if (plain.status === 0) add("info", "Site", "HTTP not answering", "Port 80 closed. Visitors typing the bare domain may get an error.");
    else add("fix", "Site", "HTTP does not go to HTTPS", `http://${u.host}/ answers ${plain.status} instead of redirecting.`);
  } else add("blocker", "Site", "Site without HTTPS", "Browsers mark it as not secure and forms send data in the clear.");
  const other = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  if (u.hostname.split(".").length <= 3) {
    const alt = await get(`https://${other}/`, { redirect: "manual", body: false, timeout: 8000 });
    if (alt.status >= 300 && alt.status < 400) add("ok", "Site", `${other} redirects`, `→ ${alt.location}`);
    else if (alt.status === 200) add("fix", "Site", `${other} answers without redirecting`, "The same site on two addresses splits links and search ranking. Redirect one to the other.");
    else if (u.hostname.split(".").length === 2 || u.hostname.startsWith("www.")) add("info", "Site", `${other} does not answer`, alt.error ?? `status ${alt.status}; people who type it get an error`);
  }
  // headers
  const home = await get(base, { body: false });
  const h = home.headers;
  const missing = [];
  if (u.protocol === "https:" && !h.get("strict-transport-security")) missing.push("Strict-Transport-Security");
  if (!h.get("x-content-type-options")) missing.push("X-Content-Type-Options");
  if (!h.get("referrer-policy")) missing.push("Referrer-Policy");
  if (!h.get("x-frame-options") && !/frame-ancestors/i.test(h.get("content-security-policy") ?? "")) missing.push("X-Frame-Options or frame-ancestors");
  if (!h.get("content-security-policy")) missing.push("Content-Security-Policy");
  if (missing.length) add(missing.length > 2 ? "fix" : "info", "Site", "Security headers", `missing: ${missing.join(", ")}`);
  else add("ok", "Site", "Security headers", "HSTS, nosniff, referrer policy, frame protection and CSP");
  const enc = h.get("content-encoding");
  add(enc ? "ok" : "fix", "Site", "Compression", enc ? `HTML sent with ${enc}` : "HTML sent uncompressed. Turn on gzip or Brotli in the server.");
  return locs;
}

// ---------------------------------------------------------------- page checks
const PLACEHOLDER = [
  [/lorem ipsum|dolor sit amet/i, "Lorem ipsum"],
  [/\b(TODO|FIXME|TBD)\b/, "TODO / TBD"],
  [/your (company|name|email|business) (here|name)|seu nome aqui|nome da empresa|sua empresa aqui/i, "template text"],
  [/\b(?:example|exemplo)\.com\b/i, "example.com"],
  [/\(?\b(?:00|11)\)?\s?0000-?0000\b|\b555-\d{4}\b|123-456-?7890/, "fake phone number"],
  [/coming soon|em breve|under construction|em constru[cç][aã]o/i, "coming soon"],
];

function collect() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const meta = (k) => (document.querySelector(`meta[name="${k}"]`) || document.querySelector(`meta[property="${k}"]`))?.content?.trim() || null;
  const imgs = [...document.images].filter((i) => i.getAttribute("src") || i.currentSrc);
  return {
    url: location.href,
    title: document.title?.trim() || null,
    description: meta("description"),
    robots: meta("robots"),
    lang: document.documentElement.lang || null,
    viewport: meta("viewport"),
    canonical: document.querySelector("link[rel=canonical]")?.href || null,
    ogImage: meta("og:image"),
    h1: [...document.querySelectorAll("h1")].filter(vis).map((h) => h.innerText.trim()),
    // visible prose only: code samples and docs may say example.com on purpose
    text: (() => {
      const c = document.body?.cloneNode(true);
      if (!c) return "";
      c.querySelectorAll("pre, code, kbd, samp, script, style, noscript, template").forEach((n) => n.remove());
      return c.textContent.replace(/\s+/g, " ");
    })(),
    links: [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, raw: a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 60) })),
    images: imgs.map((i) => ({ src: i.currentSrc || i.src, alt: i.getAttribute("alt"), w: i.naturalWidth, h: i.naturalHeight, rw: Math.round(i.getBoundingClientRect().width), broken: i.complete && i.naturalWidth === 0, decorative: i.getAttribute("role") === "presentation" || i.getAttribute("aria-hidden") === "true" })),
    footer: (document.querySelector("footer")?.innerText ?? "").slice(0, 600),
    analytics: [...document.scripts].map((s) => s.src).filter((s) => /googletagmanager|google-analytics|gtag|plausible|umami|fathom|clarity\.ms|hotjar|posthog|segment|mixpanel|vercel-insights|cloudflareinsights|matomo|meta\.com\/tr|connect\.facebook\.net/i.test(s)),
    weight: performance.getEntriesByType("resource").reduce((n, e) => n + (e.transferSize || e.encodedBodySize || 0), 0) + (performance.getEntriesByType("navigation")[0]?.transferSize || 0),
    load: Math.round(performance.getEntriesByType("navigation")[0]?.loadEventEnd || 0),
  };
}

async function checkPage(ctx, mob, url, o, i, out, isLocal) {
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().split("\n")[0].slice(0, 200)));
  page.on("requestfailed", (r) => !/net::ERR_ABORTED/.test(r.failure()?.errorText ?? "") && failed.push({ url: r.url(), type: r.resourceType(), why: r.failure()?.errorText }));
  page.on("response", (r) => r.status() >= 400 && r.url() !== url && failed.push({ url: r.url(), type: r.request().resourceType(), why: String(r.status()) }));
  let res;
  try {
    res = await page.goto(url, { waitUntil: "load", timeout: 60000 });
  } catch (e) {
    add("blocker", "Pages", "Page does not load", e.message.split("\n")[0], url);
    await page.close();
    return null;
  }
  if ((res?.status() ?? 0) >= 400) {
    const r = REF.get(url);
    add("blocker", "Links", `Page answers ${res.status()}`, r ? `“${r.text || "a link"}” on ${new URL(r.from).pathname} leads here.` : "Listed in the sitemap but broken.", url);
    await page.close();
    return null;
  }
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  if (o.hide.length) await page.addStyleTag({ content: `${o.hide.join(",")}{display:none!important}` });
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((im) => (im.loading = "eager"));
    for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 12000); y += 700) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 50));
    }
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(o.wait);
  const d = await page.evaluate(collect);
  const shot = `shots/${String(i).padStart(2, "0")}`;
  await page.screenshot({ path: join(out, `${shot}-desktop.jpg`), type: "jpeg", quality: 82 });
  await page.close();

  // phone: overflow and a screenshot
  const mp = await mob.newPage();
  await mp.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await mp.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  if (o.hide.length) await mp.addStyleTag({ content: `${o.hide.join(",")}{display:none!important}` });
  await mp.waitForTimeout(o.wait);
  const overflow = await mp.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - w;
    if (extra <= 2) return null;
    const culprit = [...document.querySelectorAll("body *")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.right > w + 2 && r.width > 0 && getComputedStyle(el).position !== "fixed";
    });
    return { extra, el: culprit ? culprit.tagName.toLowerCase() + (culprit.className && typeof culprit.className === "string" ? "." + culprit.className.trim().split(/\s+/).slice(0, 2).join(".") : "") : null };
  });
  await mp.screenshot({ path: join(out, `${shot}-phone.jpg`), type: "jpeg", quality: 82 });
  await mp.close();

  const P = url;
  const status = res?.status() ?? 0;
  const xr = res?.headers()["x-robots-tag"];
  if (/noindex/i.test(d.robots ?? "") || /noindex/i.test(xr ?? "")) add("blocker", "Search", "noindex is on", `\`${d.robots ?? xr}\`. Usually left over from staging; the page will not appear in search.`, P);
  if (!d.title) add("fix", "Search", "No <title>", "The tab and the search result show the URL.", P);
  else if (d.title.length > 65) add("info", "Search", "Long title", `${d.title.length} characters; cut after about 60 in results.`, P);
  if (!d.description) add("fix", "Search", "No meta description", "Search results and previews make one up from random text.", P);
  if (!d.h1.length) add("fix", "Content", "No h1", "The page has no main heading.", P);
  else if (d.h1.length > 1) add("info", "Content", `${d.h1.length} h1 headings`, d.h1.map((t) => `“${t.slice(0, 40)}”`).join(", "), P);
  if (!d.lang) add("fix", "Content", "No lang on <html>", "Screen readers and translators guess the language.", P);
  if (!d.viewport) add("blocker", "Mobile", "No viewport meta", "Phones render the desktop layout zoomed out.", P);
  if (!d.canonical) add("info", "Search", "No canonical", "Copies of the page with query strings compete with it.", P);
  else if (o.domain && !new URL(d.canonical).hostname.endsWith(o.domain.replace(/^www\./, ""))) add("fix", "Search", "Canonical points elsewhere", d.canonical, P);
  else if (!o.domain && !isLocal && new URL(d.canonical).hostname !== new URL(P).hostname) add("fix", "Search", "Canonical points to another domain", d.canonical, P);
  if (!d.ogImage) add("fix", "Sharing", "No share image", "Links to this page share without a picture. /coleoni-og makes one from the page.", P);
  if (overflow) add("fix", "Mobile", "Page scrolls sideways on the phone", `${overflow.extra}px wider than the screen${overflow.el ? `, starting at \`${overflow.el}\`` : ""}.`, P);
  const uniqErr = [...new Set(errors)];
  if (uniqErr.length) add("fix", "Errors", `${uniqErr.length} console error${uniqErr.length > 1 ? "s" : ""}`, uniqErr.slice(0, 3).join(" · "), P);
  const brokenRes = failed.filter((f) => !/favicon|analytics|gtag|collect/i.test(f.url));
  for (const f of brokenRes.slice(0, 6)) add(["script", "stylesheet", "document"].includes(f.type) ? "blocker" : "fix", "Errors", `${f.type} fails`, `${f.why} · ${f.url}`, P);
  if (/^https:/.test(P)) {
    const mixed = [...d.images.map((x) => x.src), ...failed.map((f) => f.url)].filter((s) => /^http:\/\//i.test(s));
    if (mixed.length) add("fix", "Errors", "Mixed content", `${mixed.length} file${mixed.length > 1 ? "s" : ""} over http on an https page: ${mixed[0]}`, P);
  }
  for (const [re, label] of PLACEHOLDER) {
    const m = d.text.match(re);
    if (m) {
      const at = d.text.indexOf(m[0]);
      add(label === "coming soon" ? "info" : "fix", "Content", `Placeholder: ${label}`, `“…${d.text.slice(Math.max(0, at - 30), at + m[0].length + 30).replace(/\s+/g, " ").trim()}…”`, P);
    }
  }
  const year = new Date().getFullYear();
  const cy = d.footer.match(/(?:©|copyright|\(c\))\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i);
  if (cy && Number(cy[1]) < year) add("fix", "Content", "Old copyright year", `Footer says ${cy[1]}.`, P);
  const dead = d.links.filter((l) => l.raw === "#" || l.raw === "" || /^javascript:void/i.test(l.raw ?? ""));
  if (dead.length) add("fix", "Links", `${dead.length} link${dead.length > 1 ? "s" : ""} to nowhere`, dead.slice(0, 4).map((l) => `“${l.text || "no text"}”`).join(", ") + ` ${dead.length > 1 ? "point" : "points"} to ${dead[0].raw || "nothing"}.`, P);
  const broken = d.images.filter((im) => im.broken);
  for (const im of broken.slice(0, 4)) add("fix", "Images", "Broken image", im.src, P);
  const noAlt = d.images.filter((im) => im.alt === null && !im.decorative && !im.broken);
  if (noAlt.length) add("fix", "Images", `${noAlt.length} image${noAlt.length > 1 ? "s" : ""} without alt`, "Screen readers read the file name. Describe it, or `alt=\"\"` if it is decoration. /coleoni-a11y checks the rest.", P);
  const heavy = d.images.filter((im) => im.rw > 0 && im.w > im.rw * 2.6 && im.w > 1600 && !/\.svg(\?|$)|^data:image\/svg/i.test(im.src));
  if (heavy.length) add("fix", "Speed", `${heavy.length} image${heavy.length > 1 ? "s" : ""} much larger than shown`, heavy.slice(0, 2).map((im) => `${im.w}px shown at ${im.rw}px: ${im.src.split("/").pop().slice(0, 50)}`).join(" · "), P);
  if (d.weight > 4 * 1048576) add("fix", "Speed", "Heavy page", `${kb(d.weight)} transferred. Phones on 4G wait for it.`, P);
  if (d.load > 5000 && !isLocal) add("info", "Speed", "Slow load", `${(d.load / 1000).toFixed(1)}s until load.`, P);
  return { url: P, status, title: d.title, lang: d.lang, h1: d.h1[0] ?? null, weight: d.weight, load: d.load, links: d.links, analytics: d.analytics, shot, images: d.images.length };
}

async function checkLinks(ctx, pages, origin, o, seen) {
  const internal = new Map();
  const external = new Map();
  for (const p of pages)
    for (const l of p.links) {
      if (!/^https?:/i.test(l.href)) continue;
      const u = clean(l.href);
      const map = new URL(u).origin === origin ? internal : external;
      if (!map.has(u)) map.set(u, { text: l.text, from: p.url });
    }
  const checked = seen;
  const run = async (map, limit, isExt) => {
    const list = [...map].filter(([u]) => !checked.has(u)).slice(0, limit);
    for (let i = 0; i < list.length; i += 8) {
      await Promise.all(
        list.slice(i, i + 8).map(async ([u, info]) => {
          let r = await ctx.request.head(u, { timeout: 12000, failOnStatusCode: false, maxRedirects: 5 }).catch(() => null);
          if (!r || r.status() === 405 || r.status() === 403 || r.status() === 501) r = await ctx.request.get(u, { timeout: 15000, failOnStatusCode: false, maxRedirects: 5 }).catch(() => null);
          const s = r?.status() ?? 0;
          if (s === 404 || s === 410) add(isExt ? "fix" : "blocker", "Links", `Broken ${isExt ? "external " : ""}link`, `“${info.text || "no text"}” → ${u} (${s})`, info.from);
          else if (!isExt && s >= 400) add("fix", "Links", `Link answers ${s}`, `“${info.text || "no text"}” → ${u}`, info.from);
          else if (isExt && s >= 500) add("info", "Links", `External link answers ${s}`, `“${info.text || "no text"}” → ${u}. Often temporary; check it by hand.`, info.from);
          else if (s === 0 && !isExt) add("fix", "Links", "Link does not answer", `“${info.text || "no text"}” → ${u}`, info.from);
        }),
      );
    }
    return list.length;
  };
  const ni = await run(internal, 200, false);
  const ne = o.external ? await run(external, 80, true) : 0;
  return { internal: ni + checked.size, external: ne };
}

// ---------------------------------------------------------------- report
const LEVEL = { blocker: "Blocks launch", fix: "To fix", info: "Worth a look", ok: "OK" };

function reportHtml(site, verdict, pages, counts, linkCounts) {
  const issues = findings.filter((f) => f.level !== "ok");
  // same problem on many pages -> one line
  const groups = new Map();
  for (const f of issues) {
    const k = `${f.level}|${f.area}|${f.title}`;
    if (!groups.has(k)) groups.set(k, { ...f, pages: [] });
    if (f.page) groups.get(k).pages.push(f.page);
  }
  const order = { blocker: 0, fix: 1, info: 2 };
  const list = [...groups.values()].sort((a, b) => order[a.level] - order[b.level]);
  const path = (u) => {
    try {
      const x = new URL(u);
      return x.pathname + x.search;
    } catch {
      return u;
    }
  };
  const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  const row = (f) => `<li class="${f.level}"><i></i><div><b>${esc(f.title)}</b><span>${md(f.detail)}</span>${f.pages?.length ? `<small>${f.pages.length > 3 ? `${f.pages.length} pages: ` : ""}${f.pages.slice(0, 3).map((p) => esc(path(p))).join(", ")}${f.pages.length > 3 ? "…" : ""}</small>` : ""}</div><em>${LEVEL[f.level]}</em></li>`;
  const ok = findings.filter((f) => f.level === "ok");
  const pageCards = pages
    .map((p) => {
      const mine = issues.filter((f) => f.page === p.url);
      const worst = mine.some((f) => f.level === "blocker") ? "blocker" : mine.some((f) => f.level === "fix") ? "fix" : "ok";
      return `<article class="pg"><div class="shots"><img src="${p.shot}-desktop.jpg" alt=""><img class="ph" src="${p.shot}-phone.jpg" alt=""></div><div class="pi"><div class="pt"><i class="${worst}"></i><b>${esc(path(p.url))}</b><span>${p.status} · ${kb(p.weight)}${p.load ? ` · ${(p.load / 1000).toFixed(1)}s` : ""}</span></div><p>${esc(p.title ?? "no title")}</p>${mine.length ? `<ul class="mini">${mine.map((f) => `<li class="${f.level}"><i></i>${esc(f.title)}</li>`).join("")}</ul>` : `<p class="clean">Nothing to fix</p>`}</div></article>`;
    })
    .join("");
  const vtext = { blocked: "Not ready", fixes: "Ready after fixes", ready: "Ready to launch" }[verdict];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Launch check · ${esc(site)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14.5px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1240px;margin:0 auto;padding:48px 32px 64px;display:grid;gap:40px}
header{display:grid;gap:18px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:44px;line-height:1.05;letter-spacing:-.025em;font-weight:650}
h1 span{color:#8b8d94}
.v{display:inline-flex;align-items:center;gap:10px;font-weight:600;font-size:15px;padding:8px 14px;border-radius:999px;width:max-content}
.v.blocked{background:#3a1715;color:#ff8a7d}.v.fixes{background:#3a2c12;color:#ffc861}.v.ready{background:#20300c;color:#aefa0e}
.v i{width:9px;height:9px;border-radius:50%;background:currentColor}
.nums{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#26272b;border:1px solid #26272b;border-radius:14px;overflow:hidden}
.nums div{background:#151619;padding:16px 18px;display:grid;gap:2px}
.nums b{font-size:28px;font-weight:650;letter-spacing:-.02em}
.nums span{color:#8b8d94;font-size:13px}
.nums .r b{color:#ff8a7d}.nums .y b{color:#ffc861}.nums .g b{color:#aefa0e}
h2{font-size:22px;letter-spacing:-.01em;font-weight:620;display:flex;gap:10px;align-items:baseline}
h2 small{font-size:13px;color:#8b8d94;font-weight:500}
section{display:grid;gap:16px}
ul{list-style:none;padding:0}
.list{border:1px solid #26272b;border-radius:14px;overflow:hidden}
.list li{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:14px;padding:14px 18px;border-top:1px solid #222327;align-items:start}
.list li:first-child{border-top:0}
.list i,.mini i,.pt i{width:9px;height:9px;border-radius:50%;margin-top:6px;background:#6b6d74}
.blocker i,i.blocker{background:#ff6b5e}.fix i,i.fix{background:#f5b84a}.ok i,i.ok{background:#aefa0e}
.list b{display:block;font-weight:600}
.list span{display:block;color:#a9abb2}
.list small{display:block;color:#7c7e85;font:12px ui-monospace,Consolas,monospace;margin-top:4px;overflow-wrap:anywhere}
.list em{font-style:normal;font-size:12px;color:#7c7e85;white-space:nowrap}
.list li.blocker em{color:#ff8a7d}.list li.fix em{color:#ffc861}
code{font:12.5px ui-monospace,"SF Mono",Consolas,monospace;background:#1d1e22;padding:1px 5px;border-radius:5px;color:#d9dade}
.oks{display:flex;flex-wrap:wrap;gap:8px}
.oks span{display:inline-flex;gap:8px;align-items:center;background:#16180f;border:1px solid #2a3318;color:#c7d6a8;border-radius:999px;padding:5px 12px;font-size:13px}
.oks span:before{content:"";width:7px;height:7px;border-radius:50%;background:#aefa0e}
.pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.pg{background:#151619;border:1px solid #26272b;border-radius:14px;overflow:hidden;display:grid}
.shots{position:relative;background:#0c0d0f;aspect-ratio:16/9.6;overflow:hidden}
.shots img{display:block;width:100%}
.shots .ph{position:absolute;right:14px;bottom:-40%;width:22%;border-radius:12px;border:3px solid #2a2b30;box-shadow:0 20px 40px -10px rgb(0 0 0 / .7)}
.pi{padding:14px 16px 16px;display:grid;gap:6px}
.pt{display:flex;gap:10px;align-items:baseline}
.pt i{flex:none;transform:translateY(-1px)}
.pt b{font:600 13.5px ui-monospace,"SF Mono",Consolas,monospace;overflow-wrap:anywhere}
.pt span{margin-left:auto;color:#7c7e85;font-size:12px;white-space:nowrap}
.pi p{color:#a9abb2;font-size:13.5px}
.mini{display:grid;gap:3px}
.mini li{display:flex;gap:9px;font-size:13px;color:#c9cacf}
.mini i{flex:none;margin-top:6px}
.clean{color:#aefa0e!important}
footer{color:#6b6d74;font-size:12.5px}
@media (max-width:820px){.w{padding:32px 18px 48px}h1{font-size:32px}.nums{grid-template-columns:repeat(2,minmax(0,1fr))}.nums div:last-child{grid-column:1/-1}.pages{grid-template-columns:minmax(0,1fr)}.list li{grid-template-columns:12px minmax(0,1fr)}.list em{grid-column:2}}
</style></head><body><div class="w">
<header><span class="k">Launch check · ${esc(new Date().toISOString().slice(0, 10))}</span><h1>${esc(site)} <span>${pages.length} page${pages.length > 1 ? "s" : ""}</span></h1><span class="v ${verdict}"><i></i>${vtext}</span></header>
<div class="nums"><div class="r"><b>${counts.blocker}</b><span>block launch</span></div><div class="y"><b>${counts.fix}</b><span>to fix</span></div><div><b>${counts.info}</b><span>worth a look</span></div><div class="g"><b>${counts.ok}</b><span>site checks ok</span></div><div><b>${linkCounts.internal + linkCounts.external}</b><span>links checked</span></div></div>
${list.length ? `<section><h2>${list.some((f) => f.level !== "info") ? "Fix first <small>grouped, most serious on top</small>" : "Worth a look"}</h2><ul class="list">${list.map(row).join("")}</ul></section>` : ""}
${ok.length ? `<section><h2>Already right</h2><div class="oks">${ok.map((f) => `<span>${esc(f.title)}</span>`).join("")}</div></section>` : ""}
<section><h2>Every page <small>desktop and phone</small></h2><div class="pages">${pageCards}</div></section>
<footer>Made by /coleoni-launch · skills.coleoni.com</footer>
</div></body></html>`;
}

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const out = resolve(o.out);
mkdirSync(join(out, "shots"), { recursive: true });

let base = o.target;
let server = null;
const isFolder = !/^[a-z]+:\/\//i.test(base) && existsSync(resolve(base));
if (isFolder) {
  const root = resolve(base);
  server = await serve(statSync(root).isDirectory() ? root : resolve(root, ".."));
  base = `http://127.0.0.1:${server.address().port}/`;
  console.log(`serving ${root} at ${base}`);
} else if (!/^[a-z]+:\/\//i.test(base)) base = /^localhost|^127\./.test(base) ? `http://${base}` : `https://${base}`;
const isLocal = isFolder || /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(base);
const homeRes = await get(base, { body: false });
if (homeRes.status === 0) fail(`${base} does not answer (${homeRes.error})`);
base = homeRes.url || base;
const origin = new URL(base).origin;
const site = o.domain ?? (isLocal ? (isFolder ? o.target.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : new URL(base).host) : new URL(base).hostname);

console.log(`checking ${base}`);
let locs = await siteChecks(base, o, isLocal);
// local build with a sitemap of production URLs: map them to the local server
if (isLocal && locs.length) locs = locs.map((l) => origin + new URL(l).pathname);

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US", timezoneId: "UTC", ignoreHTTPSErrors: false });
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-US", timezoneId: "UTC" });

const queue = [clean(base), ...locs.filter((l) => l.startsWith(origin)).map(clean)];
const seen = new Set();
const pages = [];
while (queue.length && pages.length < o.pages) {
  const u = queue.shift();
  if (seen.has(u)) continue;
  seen.add(u);
  if (/\.(pdf|jpg|jpeg|png|webp|svg|zip|xml|txt|mp4)$/i.test(new URL(u).pathname)) continue;
  const p = await checkPage(ctx, mob, u, o, pages.length, out, isLocal);
  if (!p) continue;
  pages.push(p);
  console.log(`  ${p.status} ${new URL(u).pathname}`);
  // no sitemap: follow links from the pages we already read
  for (const l of p.links) {
    if (!/^https?:/i.test(l.href) || new URL(l.href).origin !== origin) continue;
    const c = clean(l.href);
    if (!REF.has(c)) REF.set(c, { from: p.url, text: l.text });
    if (!locs.length) queue.push(c);
  }
}
const linkCounts = await checkLinks(ctx, pages, origin, o, seen);

// site-wide content checks
const titles = new Map();
// translations of a page may share its title; only the same language counts
for (const p of pages) if (p.title) titles.set(`${p.lang}|${p.title}`, [...(titles.get(`${p.lang}|${p.title}`) ?? []), p.url]);
for (const [k, us] of titles) if (us.length > 1) add("fix", "Search", "Same title on several pages", `“${k.slice(k.indexOf("|") + 1)}” on ${us.length} pages; search results look identical.`, null);
const analytics = [...new Set(pages.flatMap((p) => p.analytics.map((s) => new URL(s).hostname)))];
add("info", "Site", analytics.length ? "Analytics found" : "No analytics found", analytics.length ? `${analytics.join(", ")}. If it sets cookies, LGPD and GDPR ask for consent first.` : "Fine if on purpose. Without it, there is no way to know if the launch worked.");

await browser.close();
server?.close();

const counts = { blocker: 0, fix: 0, info: 0, ok: 0 };
for (const f of findings) counts[f.level]++;
const verdict = counts.blocker ? "blocked" : counts.fix ? "fixes" : "ready";
writeFileSync(join(out, "report.html"), reportHtml(site, verdict, pages, counts, linkCounts));
writeFileSync(join(out, "launch.json"), JSON.stringify({ site, base: isLocal ? null : base, date: new Date().toISOString(), verdict, counts, links: linkCounts, pages: pages.map(({ links, analytics, ...p }) => ({ ...p, url: isLocal ? new URL(p.url).pathname : p.url })), findings: findings.map((f) => ({ ...f, page: f.page && isLocal ? new URL(f.page).pathname : f.page })) }, null, 2));
const label = { blocker: "BLOCKER", fix: "fix", info: "info", ok: "ok" };
const where = (f) => (f.page ? ` (${new URL(f.page).pathname})` : "");
writeFileSync(
  join(out, "report.md"),
  [
    `# Launch check: ${site}`,
    ``,
    `**${{ blocked: "Not ready", fixes: "Ready after fixes", ready: "Ready to launch" }[verdict]}.** ${counts.blocker} blocking, ${counts.fix} to fix, ${counts.info} worth a look. ${pages.length} pages and ${linkCounts.internal + linkCounts.external} links checked.`,
    ``,
    ...["blocker", "fix", "info", "ok"].flatMap((lv) => {
      const fs = findings.filter((f) => f.level === lv);
      return fs.length ? [`## ${LEVEL[lv]}`, ``, ...fs.map((f) => `- [${lv === "ok" ? "x" : " "}] **${f.title}**${where(f)}: ${f.detail}`), ``] : [];
    }),
  ].join("\n"),
);
console.log(`\n${{ blocked: "NOT READY", fixes: "READY AFTER FIXES", ready: "READY" }[verdict]} · ${counts.blocker} blocking, ${counts.fix} to fix, ${counts.info} worth a look`);
console.log(`ok ${join(out, "report.html")}`);
