#!/usr/bin/env node
/**
 * Coleoni · copy review.
 *
 *   node copy.mjs <url | folder | file.html ...> --out <folder>   inventory + lint
 *   node copy.mjs --review suggestions.json --out <folder>       before/after sheet
 *
 * Inventory: opens each page and lists every piece of text a person reads
 * (title, description, headings, paragraphs, buttons, links, labels,
 * placeholders, alt text) with the mechanical problems flagged: em dashes,
 * hype words, vague buttons, long sentences, shouting, emoji, Title Case,
 * placeholders used as labels, company-centered pages and, in Portuguese,
 * gerundismo and stock phrases. Writes copy.json and copy.md.
 * Review: renders the agent's rewrites as review.html and review.png.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `
node copy.mjs <url|folder|file ...> --out <folder> [--pages 10] [--lang en|pt]
node copy.mjs --review suggestions.json --out <folder>

  --pages 10     most pages to read (follows links from the first page)
  --lang en|pt   language of the copy (default: the page's lang, then a guess)
  --review file  render the rewrites (see SKILL.md for the format)
`;

function parseArgs(argv) {
  const o = { targets: [], out: "copy-review", pages: 10, lang: null, review: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? "";
    if (!a.startsWith("--")) {
      o.targets.push(a);
      continue;
    }
    switch (a) {
      case "--help":
        console.log(HELP);
        process.exit(0);
      case "--out": o.out = val(); break;
      case "--pages": o.pages = Number(val()); break;
      case "--lang": o.lang = val(); break;
      case "--review": o.review = val(); break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!o.targets.length && !o.review) {
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

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json" };
function serve(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      let file = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!file.startsWith(root)) file = root;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
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

// ---------------------------------------------------------------- lint
const HYPE = {
  en: ["revolutioni[sz]e\\w*", "revolutionary", "transform(s|ing)? your (business|life|workflow)", "next level", "cutting[- ]edge", "state[- ]of[- ]the[- ]art", "seamless(ly)?", "innovative", "innovation", "world[- ]class", "best[- ]in[- ]class", "game[- ]chang\\w+", "unlock\\w*", "empower\\w*", "elevate\\w*", "supercharg\\w+", "effortless(ly)?", "leverag\\w+", "synerg\\w+", "robust", "one[- ]stop", "all[- ]in[- ]one", "solutions?", "passionate", "excellence", "premier", "leading", "#1", "number one", "unparalleled", "unmatched", "second to none", "top[- ]notch", "destination"],
  pt: ["revolucion\\w+", "transform(e|a|ar) (o )?seu neg[oó]cio", "pr[oó]ximo n[ií]vel", "inovador(a|es)?", "inova[cç][aã]o", "solu[cç][oõ]es( completas| inovadoras)?", "de ponta", "excel[eê]ncia", "refer[eê]ncia (no|em)", "l[ií]der (no|de|em)", "sinergia", "alavanc\\w+", "potencializ\\w+", "disruptiv\\w+", "o melhor", "a melhor", "qualidade e compromisso", "apaixonad[oa]s?", "incompar[aá]ve(l|is)", "experi[eê]ncia [uú]nica", "sem igual", "n[uú]mero 1", "do mercado"],
};
const VAGUE = {
  en: ["submit", "click here", "get started", "start now", "explore", "discover", "here", "learn more", "read more", "more", "ok", "go", "continue", "send", "click", "details", "info", "start", "next"],
  pt: ["enviar", "clique aqui", "comece agora", "começar agora", "explore", "descubra", "aqui", "saiba mais", "leia mais", "mais", "ok", "ir", "continuar", "clique", "detalhes", "info", "começar", "próximo", "acessar", "confira"],
};
const STOCK_PT = [/a n[ií]vel de/i, /no sentido de/i, /venho por meio desta/i, /\bsegue em anexo\b/i, /\bprezado cliente\b/i, /\bfica a dica\b/i];
const SMALL = new Set("a an the and or of to in on for at by with from as is are de da do das dos e o a os as em no na nos nas por para pra com um uma".split(" "));

function guessLang(text) {
  const w = (text.toLowerCase().match(/\p{L}+/gu) ?? []).slice(0, 600);
  const pt = w.filter((x) => ["de", "que", "não", "você", "para", "pra", "com", "uma", "os", "das", "é", "seu", "sua"].includes(x)).length;
  const en = w.filter((x) => ["the", "and", "you", "your", "with", "for", "is", "are", "of", "to", "our", "we"].includes(x)).length;
  return pt > en ? "pt" : "en";
}

function lint(item, lang) {
  const f = [];
  const t = item.text;
  const L = lang === "pt" ? "pt" : "en";
  if (/—|\s–\s/.test(t)) f.push(["dash", "em dash"]);
  const hype = HYPE[L].map((h) => t.match(new RegExp(`(?<![\\p{L}])${h}(?![\\p{L}])`, "iu"))?.[0]).filter(Boolean);
  if (hype.length) f.push(["hype", hype.slice(0, 3).map((h) => `“${h}”`).join(", ")]);
  if (["button", "link", "nav"].includes(item.role) && VAGUE[L].includes(t.trim().toLowerCase().replace(/[.!→›»>]+$/u, "").trim())) f.push(["vague", `“${t.trim()}” doesn't say what happens`]);
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    const n = (s.match(/\p{L}[\p{L}'’-]*/gu) ?? []).length;
    if (n > (L === "pt" ? 28 : 25)) {
      f.push(["long", `${n}-word sentence`]);
      break;
    }
  }
  if (/\b[A-ZÀ-Ý]{2,}(?:\s+[A-ZÀ-Ý]{2,}){1,}\b/.test(t) && t.replace(/[^A-ZÀ-Ý]/g, "").length >= 8) f.push(["caps", "shouting in capitals"]);
  if (/!/.test(t) && !["code"].includes(item.role)) f.push(["exclaim", "exclamation mark"]);
  if (/(?![©®™])\p{Extended_Pictographic}/u.test(t)) f.push(["emoji", "emoji"]);
  if (["h1", "h2", "h3", "button", "title"].includes(item.role)) {
    const words = t.split(/\s+/).filter((w) => /^\p{L}/u.test(w) && !SMALL.has(w.toLowerCase()));
    const caps = words.filter((w) => /^\p{Lu}\p{Ll}/u.test(w));
    if (words.length >= 3 && caps.length / words.length >= 0.75 && item.role !== "title") f.push(["titlecase", "Title Case"]);
  }
  if (/^(welcome to|bem[- ]vind[oa]s?( ao| à| a)?)\b/i.test(t.trim()) && /^h[1-3]$/.test(item.role)) f.push(["empty", "a welcome says nothing"]);
  if (/lorem ipsum|dolor sit amet/i.test(t)) f.push(["placeholder", "Lorem ipsum"]);
  if (item.role === "placeholder" && item.noLabel) f.push(["nolabel", "placeholder used as the only label"]);
  if (item.role === "alt" && /\.(jpe?g|png|webp|gif|svg)$|^(image|img|photo|foto|imagem)\s*\d*$/i.test(t.trim())) f.push(["alt", "file name or generic word as alt"]);
  if (L === "en" && /\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\s+by\b/i.test(t)) f.push(["passive", "passive voice"]);
  if (L === "pt") {
    const g = t.match(/\b(vou|vamos|vai|v[aã]o|irei|iremos|estaremos|estarei|estar[aá])\s+estar\s+\p{L}+ndo\b/iu);
    if (g) f.push(["gerund", `gerundismo: “${g[0]}”`]);
    for (const re of STOCK_PT) {
      const m = t.match(re);
      if (m) f.push(["stock", `“${m[0]}”`]);
    }
  }
  if (["description"].includes(item.role) && (t.length < 50 || t.length > 160)) f.push(["length", `${t.length} characters; aim for 50 to 160`]);
  if (item.role === "title" && t.length > 60) f.push(["length", `${t.length} characters; cut after about 60`]);
  return f.map(([rule, note]) => ({ rule, note }));
}

// ---------------------------------------------------------------- extraction
function extract() {
  const out = [];
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const txt = (el) => (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  const where = (el) => {
    const sec = el.closest("header, nav, main section, section, footer, aside, form, dialog");
    const id = sec?.id ? `#${sec.id}` : sec ? sec.tagName.toLowerCase() : "page";
    return id;
  };
  const push = (role, text, el, extra = {}) => {
    if (!text || text.length < 2) return;
    out.push({ role, text, where: el ? where(el) : "head", ...extra });
  };
  push("title", document.title?.trim(), null);
  const d = document.querySelector('meta[name="description"]')?.content?.trim();
  if (d) push("description", d, null);
  const taken = new Set();
  for (const el of document.querySelectorAll("h1, h2, h3, h4")) {
    if (!vis(el)) continue;
    taken.add(el);
    push(el.tagName.toLowerCase() === "h4" ? "h3" : el.tagName.toLowerCase(), txt(el), el);
  }
  for (const el of document.querySelectorAll('button, input[type=submit], input[type=button], [role=button], a[class*="btn"], a[class*="button"], a[class*="cta"]')) {
    if (!vis(el)) continue;
    taken.add(el);
    const t = el.tagName === "INPUT" ? el.value : txt(el) || el.getAttribute("aria-label");
    push("button", t, el);
  }
  for (const el of document.querySelectorAll("a[href]")) {
    if (!vis(el) || taken.has(el) || el.closest("h1,h2,h3,h4")) continue;
    const inNav = !!el.closest("nav, header, footer");
    const own = txt(el);
    if (!own) continue;
    // links inside a paragraph are read with the paragraph; only stand-alone links count
    const block = el.closest("p, li, td, figcaption, blockquote");
    if (block && txt(block).length > own.length + 12) continue;
    push(inNav ? "nav" : "link", own || el.getAttribute("aria-label"), el);
    taken.add(el);
  }
  for (const el of document.querySelectorAll("p, li, blockquote, figcaption, dd, td, label, small, [class*=lead], [class*=subtitle], [class*=eyebrow], footer span")) {
    if (!vis(el) || taken.has(el)) continue;
    if (el.querySelector("p, li, blockquote, h1, h2, h3, h4, ul, ol, table")) continue;
    if ([...taken].some((t) => t.contains?.(el) && t !== el)) continue;
    const t = txt(el);
    if (!t || [...el.querySelectorAll("a, button")].map(txt).join(" ").trim() === t) continue;
    push(el.tagName === "LABEL" ? "label" : "text", t, el);
  }
  for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
    if (!vis(el)) continue;
    const hasLabel = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label") || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    push("placeholder", el.placeholder, el, { noLabel: !hasLabel });
  }
  for (const el of document.images) {
    const a = el.getAttribute("alt");
    if (a && a.trim() && vis(el)) push("alt", a.trim(), el);
  }
  return { lang: document.documentElement.lang || null, items: out, links: [...document.querySelectorAll("a[href]")].map((a) => a.href), body: document.body?.innerText?.slice(0, 4000) ?? "" };
}

// ---------------------------------------------------------------- review sheet
function reviewHtml(s) {
  const tag = { dash: "em dash", hype: "hype", vague: "vague", long: "too long", caps: "shouting", exclaim: "exclamation", emoji: "emoji", titlecase: "Title Case", empty: "says nothing", placeholder: "placeholder", nolabel: "no label", alt: "bad alt", passive: "passive", gerund: "gerundismo", stock: "stock phrase", length: "length", jargon: "jargon", claim: "unproven claim", assumes: "assumes the goal", "company-first": "about us, not you", tone: "tone", grammar: "grammar", specific: "not specific", consistency: "consistency" };
  const t = s.language === "pt"
    ? { title: "Revisão de texto", before: "Antes", after: "Depois", items: "trechos reescritos", voice: { we: "a gente", I: "eu", product: "o produto fala" }, rules: "Regras" }
    : { title: "Copy review", before: "Before", after: "After", items: "rewrites", voice: { we: "we", I: "I", product: "the product speaks" }, rules: "Rules" };
  const cards = s.items
    .map((it) => `<article><header><span class="where">${esc(it.where)}</span>${it.role ? `<span class="role">${esc(it.role)}</span>` : ""}</header>
<div class="ba"><div class="b"><small>${t.before}</small><p>${esc(it.before)}</p></div><div class="a"><small>${t.after}</small><p>${esc(it.after)}</p></div></div>
<footer>${(it.why ?? []).map((w) => `<span class="why">${esc(tag[w] ?? w)}</span>`).join("")}${it.note ? `<span class="note">${esc(it.note)}</span>` : ""}</footer></article>`)
    .join("");
  return `<!doctype html><html lang="${s.language === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.title)} · ${esc(s.project)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1160px;margin:0 auto;padding:48px 32px 64px;display:grid;gap:28px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:42px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
h1 span{color:#8b8d94}
.sum{color:#b5b7bd;font-size:17px;max-width:46em;margin-top:12px}
.facts{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.facts span{border:1px solid #2a2b30;background:#16171a;border-radius:999px;padding:5px 12px;font-size:13px;color:#c9cacf}
.facts b{color:#aefa0e;font-weight:600}
article{background:#16171a;border:1px solid #26272b;border-radius:16px;overflow:hidden}
article>header{display:flex;gap:10px;align-items:center;padding:12px 18px;border-bottom:1px solid #222327}
.where{font:600 12.5px ui-monospace,"SF Mono",Consolas,monospace;color:#c9cacf}
.role{font:12px ui-monospace,Consolas,monospace;color:#7c7e85;border:1px solid #2a2b30;border-radius:6px;padding:1px 7px}
.ba{display:grid;grid-template-columns:1fr 1fr}
.ba>div{padding:16px 18px 18px;display:grid;gap:6px;align-content:start}
.ba small{font:600 11px system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#7c7e85}
.b{border-right:1px solid #222327}
.b p{color:#9a9ca3;text-decoration:line-through;text-decoration-color:rgb(255 107 94 / .55);text-decoration-thickness:1.5px}
.a small{color:#aefa0e}
.a p{color:#f4f4f5;font-size:16px}
article>footer{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 18px 14px}
.why{font-size:12px;color:#ffc861;background:#2b2210;border-radius:999px;padding:2px 9px}
.note{font-size:13px;color:#8b8d94;margin-left:4px}
.list{display:grid;gap:14px}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:760px){.w{padding:32px 18px 48px}h1{font-size:30px}.ba{grid-template-columns:1fr}.b{border-right:0;border-bottom:1px solid #222327}}
</style></head><body><div class="w">
<header><span class="k">${esc(t.title)} · ${esc(new Date().toISOString().slice(0, 10))}</span><h1>${esc(s.project)} <span>${s.items.length} ${t.items}</span></h1>${s.summary ? `<p class="sum">${esc(s.summary)}</p>` : ""}
<div class="facts">${s.voice ? `<span>${s.language === "pt" ? "Quem fala" : "Who speaks"}: <b>${esc(t.voice[s.voice] ?? s.voice)}</b></span>` : ""}${s.language ? `<span>${s.language === "pt" ? "Língua" : "Language"}: <b>${s.language === "pt" ? "PT-BR" : "EN"}</b></span>` : ""}${(s.counts ?? []).map(([n, l]) => `<span><b>${esc(n)}</b> ${esc(l)}</span>`).join("")}</div></header>
<div class="list">${cards}</div>
<p class="foot">Made by /coleoni-copy · skills.coleoni.com</p>
</div></body></html>`;
}

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const out = resolve(o.out);
mkdirSync(out, { recursive: true });

if (o.review) {
  const s = JSON.parse(readFileSync(resolve(o.review), "utf8"));
  if (!Array.isArray(s.items)) fail("suggestions.json needs an items array");
  writeFileSync(join(out, "review.html"), reviewHtml(s));
  const browser = await launch();
  const p = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(join(out, "review.html")).href, { waitUntil: "load" });
  await p.screenshot({ path: join(out, "review.png"), fullPage: true });
  await browser.close();
  console.log(`ok ${join(out, "review.html")}`);
  console.log(`ok ${join(out, "review.png")}`);
  process.exit(0);
}

// inventory
let server = null;
const starts = [];
for (const t of o.targets) {
  if (/^[a-z]+:\/\//i.test(t)) starts.push(t);
  else if (existsSync(resolve(t))) {
    const p = resolve(t);
    const root = statSync(p).isDirectory() ? p : resolve(p, "..");
    server ??= await serve(root);
    const base = `http://127.0.0.1:${server.address().port}/`;
    starts.push(statSync(p).isDirectory() ? base : base + p.slice(root.length + 1).replace(/\\/g, "/"));
  } else starts.push(/^localhost|^127\./.test(t) ? `http://${t}` : `https://${t}`);
}
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US", timezoneId: "UTC" });
const origin = new URL(starts[0]).origin;
const queue = [...starts];
const seen = new Set();
const pages = [];
while (queue.length && pages.length < o.pages) {
  const u = queue.shift().replace(/#.*$/, "");
  if (seen.has(u)) continue;
  seen.add(u);
  if (/\.(pdf|jpe?g|png|webp|svg|zip|xml|txt)$/i.test(new URL(u).pathname)) continue;
  const page = await ctx.newPage();
  try {
    const r = await page.goto(u, { waitUntil: "load", timeout: 60000 });
    if ([404, 410].includes(r?.status() ?? 0)) throw new Error(`status ${r.status()}`);
    if ((r?.status() ?? 0) >= 400) console.log(`  note: ${u} answers ${r.status()}; reading it anyway`);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const d = await page.evaluate(extract);
    const lang = o.lang ?? (d.lang ? (d.lang.toLowerCase().startsWith("pt") ? "pt" : "en") : guessLang(d.body));
    const path = new URL(u).pathname;
    pages.push({ url: u, path, lang, items: d.items.map((it) => ({ ...it, flags: lint(it, lang) })) });
    if (starts.length === 1) for (const l of d.links) if (l.startsWith(origin) && !seen.has(l.replace(/#.*$/, ""))) queue.push(l);
    console.log(`  ${path}  ${d.items.length} pieces`);
  } catch (e) {
    console.log(`  skipped ${u}: ${e.message.split("\n")[0]}`);
  }
  await page.close();
}
await browser.close();
server?.close();
if (!pages.length) fail("no page could be read");

// the same text on several pages (nav, footer) is listed once
const seenText = new Map();
for (const p of pages)
  for (const it of p.items) {
    const k = `${it.role}|${it.text}`;
    if (seenText.has(k)) {
      seenText.get(k).also.push(p.path);
      it.dup = true;
    } else seenText.set(k, Object.assign(it, { also: [] }));
  }
// whose page is it: the company's or the reader's
for (const p of pages) {
  const all = p.items.filter((i) => !i.dup && ["text", "h1", "h2", "h3", "description"].includes(i.role)).map((i) => i.text).join(" ").toLowerCase();
  const we = (all.match(p.lang === "pt" ? /\b(n[oó]s|nossa?s?|nosso?s?)\b/g : /\b(we|our|ours|us)\b/g) ?? []).length;
  const you = (all.match(p.lang === "pt" ? /\b(voc[eê]s?|seus?|suas?)\b/g : /\b(you|your|yours)\b/g) ?? []).length;
  p.voice = { we, you };
  if (we >= 4 && we > you * 1.5) p.flag = { rule: "company-first", note: `talks about itself (${we}× ${p.lang === "pt" ? "nós/nosso" : "we/our"}) more than the reader (${you}× ${p.lang === "pt" ? "você/seu" : "you/your"})` };
}

const items = pages.flatMap((p) => p.items.filter((i) => !i.dup).map((i) => ({ page: p.path, ...i })));
const flagged = items.filter((i) => i.flags.length);
const byRule = {};
for (const i of flagged) for (const f of i.flags) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
for (const p of pages) if (p.flag) byRule[p.flag.rule] = (byRule[p.flag.rule] ?? 0) + 1;
writeFileSync(join(out, "copy.json"), JSON.stringify({ pages: pages.map((p) => ({ path: p.path, lang: p.lang, voice: p.voice, flag: p.flag ?? null })), counts: byRule, items: items.map(({ dup, ...i }) => i) }, null, 2));

const ROLE = { title: "Title", description: "Description", h1: "H1", h2: "H2", h3: "H3", text: "Text", button: "Button", link: "Link", nav: "Menu and footer", label: "Label", placeholder: "Placeholder", alt: "Alt text" };
const md = [`# Copy inventory`, ``, `${pages.length} page${pages.length > 1 ? "s" : ""}, ${items.length} pieces of text, ${flagged.length} flagged.`, ``];
if (Object.keys(byRule).length) md.push(`Flags: ${Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(" · ")}`, ``);
md.push(`Flags are mechanical. The review (voice, clarity, what the reader gets) is the agent's job, following references/voice.md.`, ``);
for (const p of pages) {
  md.push(`## ${p.path}  (${p.lang})`, ``);
  if (p.flag) md.push(`> ⚑ ${p.flag.note}`, ``);
  for (const role of Object.keys(ROLE)) {
    const its = p.items.filter((i) => i.role === role && !i.dup);
    if (!its.length) continue;
    md.push(`**${ROLE[role]}**`, ``);
    for (const i of its) md.push(`- ${i.text.replace(/\n/g, " ")}${i.where && i.where !== "head" ? `  \`${i.where}\`` : ""}${i.also.length ? `  (also on ${i.also.length} other page${i.also.length > 1 ? "s" : ""})` : ""}${i.flags.length ? `\n  ⚑ ${i.flags.map((f) => `${f.rule}: ${f.note}`).join(" · ")}` : ""}`);
    md.push(``);
  }
}
writeFileSync(join(out, "copy.md"), md.join("\n"));
console.log(`\n${items.length} pieces of text, ${flagged.length} flagged${Object.keys(byRule).length ? ` (${Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(", ")})` : ""}`);
console.log(`ok ${join(out, "copy.md")}`);
