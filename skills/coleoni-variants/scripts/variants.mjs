#!/usr/bin/env node
/**
 * Coleoni · variations of a component, side by side, in the real page.
 *
 *   node variants.mjs <url | folder | file.html> --select ".hero" --variants variants.json --out <folder>
 *
 * Applies each variation (CSS, and optionally new HTML for the component) to
 * the live page, so it is judged with the real fonts, colors and surroundings.
 * Captures the component on desktop and on a phone, plus the first screen
 * around it, checks each variation for sideways scroll, clipped text and
 * console errors, and lays everything out next to the current version.
 * Writes board.html, board.png, variants.md and one folder of shots.
 *
 * variants.json:
 *   { "title": "Menu card", "brief": "what we are choosing",
 *     "variants": [ { "name": "Receipt", "note": "why", "css": "...", "html": "...", "replace": "inner|outer" } ] }
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `
node variants.mjs <url|folder|file> --select "<css selector>" --variants variants.json --out <folder> [options]

  --select ".card"       the component
  --variants file.json   the variations (see SKILL.md)
  --width 1280           desktop viewport width (the phone is 390)
  --lang en|pt           language of the board
  --wait 400             extra wait after load, in ms
`;

function parseArgs(argv) {
  const o = { target: null, select: null, variants: null, out: "variants-report", width: 1280, lang: "en", wait: 400 };
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
      case "--select": o.select = val(); break;
      case "--variants": o.variants = val(); break;
      case "--out": o.out = val(); break;
      case "--width": o.width = Number(val()); break;
      case "--lang": o.lang = val() === "pt" ? "pt" : "en"; break;
      case "--wait": o.wait = Number(val()); break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!o.target || !o.select || !o.variants) {
    console.log(HELP);
    process.exit(1);
  }
  return o;
}
const fail = (m) => {
  console.error(m);
  process.exit(1);
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json" };
function serve(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      let file = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!file.startsWith(root)) file = root;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file)) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

// what breaks a variation: the page scrolls sideways, text gets cut
function check(sel) {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const issues = [];
  const side = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (side > 2) issues.push(`sideways ${side}px`);
  for (const el of [root, ...root.querySelectorAll("*")]) {
    const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX + cs.overflow) && cs.textOverflow !== "ellipsis") {
      issues.push("clipped");
      break;
    }
  }
  return { issues };
}

const T = {
  en: { title: "Variations", current: "Current", desktop: "Desktop", phone: "Phone", context: "In the page", pick: "Pick one: 1, 2 or 3, or mix (“2 with the prices of 3”).", sideways: "scrolls sideways on the phone", clipped: "text cut off", error: "error", made: "Made by /coleoni-variants · skills.coleoni.com" },
  pt: { title: "Variações", current: "Atual", desktop: "Computador", phone: "Celular", context: "Na página", pick: "Escolha uma: 1, 2 ou 3, ou misture (“a 2 com os preços da 3”).", sideways: "rola pro lado no celular", clipped: "texto cortado", error: "erro", made: "Feito pela /coleoni-variants · skills.coleoni.com" },
};

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const t = T[o.lang];
const out = resolve(o.out);
mkdirSync(join(out, "shots"), { recursive: true });
const spec = JSON.parse(readFileSync(resolve(o.variants), "utf8"));
if (!Array.isArray(spec.variants) || !spec.variants.length) fail("variants.json needs a variants array");

let url = o.target;
let server = null;
if (!/^[a-z]+:\/\//i.test(url) && existsSync(resolve(url))) {
  const p = resolve(url);
  const root = statSync(p).isDirectory() ? p : resolve(p, "..");
  server = await serve(root);
  url = `http://127.0.0.1:${server.address().port}/${statSync(p).isDirectory() ? "" : p.slice(root.length + 1).replace(/\\/g, "/")}`;
} else if (!/^[a-z]+:\/\//i.test(url)) url = /^localhost|^127\./.test(url) ? `http://${url}` : `https://${url}`;

const browser = await launch();
async function shoot(v, i, phone) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: o.width, height: 900 }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  if (v) {
    if (v.html) {
      const ok = await page.evaluate(({ sel, html, replace }) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        if (replace === "outer") el.outerHTML = html;
        else el.innerHTML = html;
        return true;
      }, { sel: o.select, html: v.html, replace: v.replace ?? "inner" });
      if (!ok) fail(`no element matches ${o.select}`);
    }
    if (v.css) await page.addStyleTag({ content: v.css });
  }
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}" });
  await page.waitForTimeout(o.wait);
  const res = await page.evaluate(check, o.select);
  if (res.missing) fail(`no element matches ${o.select} on ${url}`);
  const el = await page.$(o.select);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  const vp = page.viewportSize();
  const pad = phone ? 12 : 20;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const tag = `${i}-${phone ? "phone" : "desktop"}`;
  await page.screenshot({ path: join(out, "shots", `${tag}.jpg`), type: "jpeg", quality: 88, clip: { x, y, width: Math.min(vp.width - x, box.width + pad * 2), height: Math.min(box.height + pad * 2, phone ? 1500 : 1100) } });
  if (!phone) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(out, "shots", `${i}-context.jpg`), type: "jpeg", quality: 82 });
  }
  await ctx.close();
  return { issues: res.issues, errors };
}

const cols = [{ name: t.current, note: "", current: true }, ...spec.variants];
const results = [];
for (const [i, v] of cols.entries()) {
  const d = await shoot(v.current ? null : v, i, false);
  const p = await shoot(v.current ? null : v, i, true);
  const issues = [...new Set([...d.issues.filter((x) => x === "clipped").map(() => t.clipped), ...p.issues.map((x) => (x.startsWith("sideways") ? t.sideways : t.clipped)), ...[...d.errors, ...p.errors].slice(0, 1).map((e) => `${t.error}: ${e}`)])];
  results.push({ i, name: v.name, note: v.note ?? "", current: !!v.current, issues });
  console.log(`  ${v.current ? "current" : `${i}. ${v.name}`}${issues.length ? "  " + issues.join(" · ") : ""}`);
}
await browser.close();
server?.close();

// ---------------------------------------------------------------- board
const n = results.length;
const html = `<!doctype html><html lang="${o.lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title} · ${esc(spec.title ?? o.select)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:${n > 3 ? 1760 : 1400}px;margin:0 auto;padding:44px 32px 56px;display:grid;gap:26px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:40px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
.brief{color:#b5b7bd;font-size:16px;max-width:52em;margin-top:10px}
.pick{color:#aefa0e;font-size:14px;margin-top:8px}
.cols{display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:16px;align-items:start}
.col{background:#16171a;border:1px solid #26272b;border-radius:16px;overflow:hidden;display:grid}
.col.cur{background:#131416;border-style:dashed}
.hd{display:flex;gap:12px;align-items:center;padding:14px 16px 4px}
.num{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:#aefa0e;color:#111214;flex:none}
.cur .num{background:#2a2b30;color:#c9cacf;font-size:11px}
.hd b{font-size:16px;font-weight:620}
.note{color:#9a9ca3;font-size:13px;padding:2px 16px 12px;min-height:40px}
.lab{font:600 10.5px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b6d74;padding:10px 16px 6px;border-top:1px solid #222327}
.shot{padding:0 12px 12px;display:grid;place-items:center}
.shot img{max-width:100%;display:block;border-radius:8px}
.ph img{max-width:62%;border-radius:14px;box-shadow:0 0 0 6px #232428}
.iss{list-style:none;padding:0 16px 14px;display:grid;gap:4px}
.iss li{font-size:12.5px;color:#ffb4ab;display:flex;gap:8px}
.iss li:before{content:"";width:7px;height:7px;border-radius:50%;background:#ff6b5e;margin-top:6px;flex:none}
.ok{color:#aefa0e;font-size:12.5px;padding:0 16px 14px}
details{border-top:1px solid #222327}
summary{cursor:pointer;padding:10px 16px;color:#8b8d94;font-size:12.5px}
details img{width:100%;display:block}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:900px){.w{padding:28px 16px 40px}h1{font-size:28px}.cols{grid-template-columns:minmax(0,1fr)}}
</style></head><body><div class="w">
<div><span class="k">${t.title} · ${new Date().toISOString().slice(0, 10)}</span><h1>${esc(spec.title ?? o.select)}</h1>${spec.brief ? `<p class="brief">${esc(spec.brief)}</p>` : ""}<p class="pick">${t.pick}</p></div>
<div class="cols">${results
  .map(
    (r) => `<section class="col${r.current ? " cur" : ""}"><div class="hd"><span class="num">${r.current ? "0" : r.i}</span><b>${esc(r.name)}</b></div><p class="note">${esc(r.note)}</p>
<p class="lab">${t.desktop}</p><div class="shot"><img src="shots/${r.i}-desktop.jpg" alt=""></div>
<p class="lab">${t.phone}</p><div class="shot ph"><img src="shots/${r.i}-phone.jpg" alt=""></div>
${r.issues.length ? `<ul class="iss">${r.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : r.current ? "" : `<p class="ok">${o.lang === "pt" ? "Sem quebra no computador nem no celular" : "Holds on desktop and phone"}</p>`}
<details><summary>${t.context}</summary><img src="shots/${r.i}-context.jpg" alt=""></details></section>`,
  )
  .join("")}</div>
<p class="foot">${t.made}</p>
</div></body></html>`;
writeFileSync(join(out, "board.html"), html);
writeFileSync(join(out, "variants.md"), [`# ${t.title}: ${spec.title ?? o.select}`, ``, spec.brief ?? "", ``, ...results.map((r) => `${r.current ? "0" : r.i}. **${r.name}**${r.note ? `: ${r.note}` : ""}${r.issues.length ? ` ⚑ ${r.issues.join("; ")}` : ""}`)].join("\n"));
const b2 = await launch();
const pv = await b2.newPage({ viewport: { width: n > 3 ? 1760 : 1400, height: 900 } });
await pv.goto(pathToFileURL(join(out, "board.html")).href, { waitUntil: "load" });
await pv.screenshot({ path: join(out, "board.png"), fullPage: true });
await b2.close();
console.log(`ok ${join(out, "board.html")}`);
