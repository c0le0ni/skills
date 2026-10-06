/**
 * Coleoni · shared base of the interface family (polish, type, color, layout,
 * interface): browser, local server, element crops and the report page.
 * The same file ships with each skill so every skill installs on its own.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fail = (m) => {
  console.error(m);
  process.exit(1);
};

/** --flag value pairs, --switch booleans, the rest positional */
export function parseArgs(argv, defaults, help) {
  const o = { ...defaults, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help") {
      console.log(help);
      process.exit(0);
    }
    if (!a.startsWith("--")) {
      o._.push(a);
      continue;
    }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!(key in defaults)) fail(`unknown option: ${a}`);
    if (typeof defaults[key] === "boolean") o[key] = !defaults[key];
    else if (typeof defaults[key] === "number") o[key] = Number(argv[++i]);
    else if (Array.isArray(defaults[key])) o[key] = [...o[key], argv[++i]];
    else o[key] = argv[++i] ?? "";
  }
  if (o.lang) o.lang = o.lang === "pt" ? "pt" : "en";
  return o;
}

export async function launch() {
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

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".json": "application/json" };

/** A URL as given, or a local file/folder served on a temporary port */
export async function open(target) {
  if (/^[a-z]+:\/\//i.test(target)) return { url: target, name: new URL(target).hostname + new URL(target).pathname.replace(/\/$/, ""), close() {} };
  const p = resolve(target);
  if (!existsSync(p)) return { url: /^localhost|^127\./.test(target) ? `http://${target}` : `https://${target}`, name: target, close() {} };
  const root = statSync(p).isDirectory() ? p : resolve(p, "..");
  const server = await new Promise((done) => {
    const s = createServer((req, res) => {
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
    s.listen(0, "127.0.0.1", () => done(s));
  });
  const rel = statSync(p).isDirectory() ? "" : p.slice(root.length + 1).replace(/\\/g, "/");
  return { url: `http://127.0.0.1:${server.address().port}/${rel}`, name: (statSync(p).isDirectory() ? p : root).split(/[\\/]/).pop(), close: () => server.close() };
}

/** Load a page the way the family reads it: no motion, fonts ready, lazy images in */
export async function load(browser, url, { width = 1280, height = 900, wait = 400, phone = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC", bypassCSP: true });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 10000); y += 700) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 40));
    }
    scrollTo({ top: 0, behavior: "instant" });
    await document.fonts?.ready;
  });
  await page.addStyleTag({ content: ".reveal,[data-aos],.fade-in,.fade-up{opacity:1!important;transform:none!important}" });
  await page.waitForTimeout(wait);
  return { page, ctx };
}

/** Crop elements marked data-cx="id" with a red outline, page coordinates */
export async function crop(page, ids, file, { pad = 18, max = [900, 500], outline = true } = {}) {
  const box = await page.evaluate(({ ids, outline }) => {
    const els = ids.map((id) => document.querySelector(`[data-cx="${id}"]`)).filter(Boolean);
    if (!els.length) return null;
    els[0].scrollIntoView({ block: "center", behavior: "instant" });
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const el of els) {
      const q = el.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      if (!outline) continue;
      el.style.setProperty("outline", "2.5px solid #ff3b6b", "important");
      el.style.setProperty("outline-offset", "2px", "important");
    }
    return { l, t, r, b };
  }, { ids, outline });
  if (!box) return null;
  const vp = page.viewportSize();
  const x = Math.max(0, box.l - pad);
  const y = Math.max(0, box.t - pad);
  const w = Math.min(vp.width - x, box.r - box.l + pad * 2, max[0]);
  const h = Math.min(vp.height - y, box.b - box.t + pad * 2, max[1]);
  if (w < 8 || h < 8) return null;
  await page.screenshot({ path: file, type: "jpeg", quality: 86, clip: { x, y, width: w, height: h } });
  await page.evaluate((ids) => ids.forEach((id) => { const el = document.querySelector(`[data-cx="${id}"]`); el?.style.removeProperty("outline"); el?.style.removeProperty("outline-offset"); }), ids);
  return true;
}

/** Shoot the crops a list of findings asks for (finding.ids = [[id, id], [id]]) */
export async function shootFindings(page, findings, dir, prefix, limit = 3) {
  mkdirSync(join(dir, "shots"), { recursive: true });
  let n = 0;
  for (const f of findings) {
    f.shots = [];
    for (const group of (f.ids ?? []).slice(0, limit)) {
      const file = `shots/${prefix}-${n++}.jpg`;
      if (await crop(page, group, join(dir, file))) f.shots.push(file);
    }
    delete f.ids;
  }
}

export const LEVELS = {
  en: { high: "Fix first", medium: "Fix", low: "Worth a look" },
  pt: { high: "Corrigir primeiro", medium: "Corrigir", low: "Vale olhar" },
};

/** The report page every skill of the family writes */
export function report({ lang, kicker, title, sub, chips = [], findings = [], sections = [], made }) {
  const L = LEVELS[lang];
  const order = { high: 0, medium: 1, low: 2 };
  const list = [...findings].sort((a, b) => order[a.level] - order[b.level]);
  const card = (f) => `<li class="${f.level}"><div class="hd"><i></i><b>${esc(f.title)}</b><em>${L[f.level]}</em></div>${f.detail ? `<p>${f.detail}</p>` : ""}${f.shots?.length ? `<div class="crops">${f.shots.map((s) => `<img src="${s}" alt="">`).join("")}</div>` : ""}${f.where ? `<code class="where">${esc(f.where)}</code>` : ""}${f.fix ? `<div class="fix"><small>${lang === "pt" ? "Como corrigir" : "How to fix"}</small>${f.fix}</div>` : ""}${f.skill ? `<span class="skill">/${esc(f.skill)}</span>` : ""}</li>`;
  return `<!doctype html><html lang="${lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(kicker)} · ${esc(title)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14.5px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1240px;margin:0 auto;padding:44px 32px 60px;display:grid;gap:34px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:40px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
h1 span{color:#8b8d94}
.sub{color:#b5b7bd;font-size:16px;max-width:52em;margin-top:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chips span{border:1px solid #2a2b30;background:#16171a;border-radius:999px;padding:5px 12px;font-size:13px;color:#c9cacf}
.chips b{font-weight:650;color:#f4f4f5}.chips .r b{color:#ff8a7d}.chips .y b{color:#ffc861}.chips .g b{color:#aefa0e}
h2{font-size:22px;font-weight:620;letter-spacing:-.01em;display:flex;gap:10px;align-items:baseline}
h2 small{font-size:13px;color:#8b8d94;font-weight:500}
section{display:grid;gap:14px}
ul.f{list-style:none;padding:0;display:grid;gap:12px}
ul.f>li{background:#16171a;border:1px solid #26272b;border-radius:14px;padding:16px 18px;display:grid;gap:10px}
.hd{display:flex;gap:12px;align-items:baseline}
.hd i{width:9px;height:9px;border-radius:50%;flex:none;background:#6b6d74;transform:translateY(-1px)}
li.high .hd i{background:#ff6b5e}li.medium .hd i{background:#f5b84a}
.hd b{font-size:15.5px;font-weight:600}
.hd em{margin-left:auto;font-style:normal;font-size:12px;color:#7c7e85;white-space:nowrap}
li.high .hd em{color:#ff8a7d}li.medium .hd em{color:#ffc861}
ul.f>li>p{color:#a9abb2}
ul.f>li>p code,.fix code{font:12.5px ui-monospace,"SF Mono",Consolas,monospace;background:#1d1e22;padding:1px 5px;border-radius:5px;color:#d9dade}
.crops{display:flex;flex-wrap:wrap;gap:10px}
.crops img{max-width:min(100%,380px);max-height:200px;border-radius:8px;border:1px solid #26272b;background:#0c0d0f}
.where{font:11.5px ui-monospace,"SF Mono",Consolas,monospace;color:#7c7e85;overflow-wrap:anywhere}
.fix{font-size:13.5px;color:#c9cacf;border-top:1px solid #222327;padding-top:10px}
.fix small{display:block;font:600 11px system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#7c7e85;margin-bottom:2px}
.skill{justify-self:start;font:12px ui-monospace,Consolas,monospace;color:#aefa0e;border:1px solid #2c3a16;background:#18200c;border-radius:999px;padding:1px 9px}
.panel{background:#16171a;border:1px solid #26272b;border-radius:14px;padding:18px 20px;overflow:hidden}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:760px){.w{padding:28px 16px 44px}h1{font-size:28px}}
</style></head><body><div class="w">
<header><span class="k">${esc(kicker)} · ${new Date().toISOString().slice(0, 10)}</span><h1>${esc(title)}${sub ? ` <span>${esc(sub)}</span>` : ""}</h1>${chips.length ? `<div class="chips">${chips.map(([n, label, cls]) => `<span class="${cls ?? ""}"><b>${esc(n)}</b> ${esc(label)}</span>`).join("")}</div>` : ""}</header>
${sections.filter((s) => s.first).map((s) => `<section><h2>${s.title}${s.note ? ` <small>${s.note}</small>` : ""}</h2>${s.html}</section>`).join("")}
${list.length ? `<section><h2>${lang === "pt" ? "O que corrigir" : "What to fix"} <small>${lang === "pt" ? "o mais importante no topo" : "most important first"}</small></h2><ul class="f">${list.map(card).join("")}</ul></section>` : ""}
${sections.filter((s) => !s.first).map((s) => `<section><h2>${s.title}${s.note ? ` <small>${s.note}</small>` : ""}</h2>${s.html}</section>`).join("")}
<p class="foot">${esc(made)}</p>
</div></body></html>`;
}

/** report.html + report.png + report.json + report.md */
export async function writeReport(dir, html, data, md, browser, width = 1240) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "report.html"), html);
  writeFileSync(join(dir, "report.json"), JSON.stringify(data, null, 2));
  writeFileSync(join(dir, "report.md"), md);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(pathToFileURL(join(dir, "report.html")).href, { waitUntil: "load" });
  await page.screenshot({ path: join(dir, "report.png"), fullPage: true });
  await page.close();
}

export const mdFindings = (findings, lang) =>
  findings.map((f) => `- **[${LEVELS[lang][f.level]}] ${f.title}**${f.where ? ` \`${f.where}\`` : ""}\n  ${String(f.detail ?? "").replace(/<br>/g, " · ").replace(/<[^>]+>/g, "")}${f.fix ? `\n  ${lang === "pt" ? "Como corrigir" : "Fix"}: ${String(f.fix).replace(/<[^>]+>/g, "")}` : ""}`).join("\n");
