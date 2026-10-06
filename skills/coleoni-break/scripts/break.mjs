#!/usr/bin/env node
/**
 * Coleoni · break a component on purpose.
 *
 *   node break.mjs <url | folder | file.html> --select ".card" --out <folder>
 *
 * Opens the real page and, one scenario at a time, does to the component what
 * real content and real users will: text three times longer, a word that
 * won't wrap, no text at all, a translation 40% longer, huge numbers, names
 * with accents and emoji, missing images, one item and 25 items, right to
 * left, a 320px screen, text at 200%, Windows high contrast and dark mode.
 * After each one it measures what broke (clipped text, overlaps, content
 * spilling out, sideways scroll, collapsed images), outlines it and crops the
 * component. Writes break.html, break.png, break.md and break.json.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALL = ["long", "word", "empty", "translate", "numbers", "names", "images", "one", "many", "rtl", "narrow", "text200", "contrast", "dark"];
const HELP = `
node break.mjs <url|folder|file> --select "<css selector>" --out <folder> [options]

  --select ".card"     the component to break (default: main, then body)
  --scenarios a,b      only these (default: all)
                       ${ALL.join(", ")}
  --width 1280         desktop viewport width (narrow is always 320)
  --lang en|pt         language of the sheet (default en)
  --wait 400           extra wait after load, in ms
`;

function parseArgs(argv) {
  const o = { target: null, select: null, scenarios: ALL, out: "break-report", width: 1280, lang: "en", wait: 400 };
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
      case "--scenarios": o.scenarios = val().split(",").map((s) => s.trim()).filter((s) => ALL.includes(s)); break;
      case "--out": o.out = val(); break;
      case "--width": o.width = Number(val()); break;
      case "--lang": o.lang = val() === "pt" ? "pt" : "en"; break;
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

// ---------------------------------------------------------------- scenarios (run in the page)
function mutate({ sel, kind }) {
  const root = document.querySelector(sel) ?? document.querySelector("main") ?? document.body;
  const texts = () => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim().length > 1 && !n.parentElement.closest("script,style,svg,code,pre") ? 1 : 2) });
    const out = [];
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  };
  // the element inside the component with the most repeated children: the list
  const list = () => {
    let best = null;
    let n = 1;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const kids = [...el.children].filter((k) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(k.tagName));
      if (kids.length < 2) continue;
      const tag = kids[0].tagName + "." + kids[0].className;
      const same = kids.filter((k) => k.tagName + "." + k.className === tag).length;
      if (same > n) {
        n = same;
        best = { el, kids: kids.filter((k) => k.tagName + "." + k.className === tag) };
      }
    }
    return best;
  };
  const ACC = { a: "á", e: "é", i: "í", o: "ö", u: "ü", c: "ç", n: "ñ", s: "š", y: "ý", A: "Å", E: "É", I: "Î", O: "Ø", U: "Û", C: "Ç", N: "Ñ", S: "Š" };
  switch (kind) {
    case "long":
      for (const t of texts()) t.nodeValue = `${t.nodeValue.trim()} ${t.nodeValue.trim()} ${t.nodeValue.trim()}`;
      break;
    case "word":
      for (const t of texts()) {
        const words = t.nodeValue.split(/(\s+)/);
        let k = 0;
        words.forEach((w, i) => (w.length > (words[k]?.length ?? 0) ? (k = i) : 0));
        words[k] = "Donaudampfschifffahrtsgesellschaftskapitän";
        t.nodeValue = words.join("");
      }
      break;
    case "empty":
      for (const t of texts()) t.nodeValue = "";
      break;
    case "translate":
      for (const t of texts()) {
        const s = t.nodeValue.replace(/[a-zA-Z]/g, (c) => ACC[c] ?? c);
        t.nodeValue = s.replace(/(\S+)(\s*)$/, (m, w, sp) => `${w} ${"ŵőřđ ".repeat(Math.max(1, Math.round(s.trim().split(/\s+/).length * 0.4))).trim()}${sp}`);
      }
      break;
    case "numbers":
      for (const t of texts()) t.nodeValue = t.nodeValue.replace(/\d+(?:[.,:]\d+)*/g, "1,234,567.89");
      break;
    case "names":
      for (const t of texts()) if (t.nodeValue.trim().length < 40) t.nodeValue = `${t.nodeValue.trim()} Zoë Ñúñez-O'Brien 🎂`;
      break;
    case "images":
      for (const im of root.querySelectorAll("img")) {
        im.removeAttribute("srcset");
        im.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=x";
      }
      for (const s of root.querySelectorAll("picture source")) s.remove();
      for (const el of [root, ...root.querySelectorAll("*")]) if (getComputedStyle(el).backgroundImage.includes("url(")) el.style.backgroundImage = "none";
      break;
    case "one": {
      const l = list();
      if (l) l.kids.slice(1).forEach((k) => k.remove());
      return { changed: !!l };
    }
    case "many": {
      const l = list();
      if (!l) return { changed: false };
      let i = 0;
      while (l.el.children.length < 25) l.el.appendChild(l.kids[i++ % l.kids.length].cloneNode(true));
      return { changed: true };
    }
    case "rtl":
      document.documentElement.dir = "rtl";
      root.dir = "rtl";
      break;
    case "text200": {
      // what the browser's font size setting does: only the root grows; text in px stays put
      for (const el of [root, ...root.querySelectorAll("*")]) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
      const html = document.documentElement;
      html.style.fontSize = `${parseFloat(getComputedStyle(html).fontSize) * 2}px`;
      break;
    }
  }
  return { changed: true };
}

// what broke: clipped text, overlaps, content leaving the component, sideways scroll, empty holes
function measure(sel) {
  const root = document.querySelector(sel) ?? document.querySelector("main") ?? document.body;
  const R = root.getBoundingClientRect();
  const found = [];
  const name = (el) => {
    const c = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + c;
  };
  const mark = (el) => el.setAttribute("data-broke", "1");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const all = [root, ...root.querySelectorAll("*")].filter((el) => !el.closest("svg") && vis(el));
  for (const el of all) {
    const cs = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX + cs.overflow) && cs.textOverflow !== "ellipsis") {
      found.push({ type: "clipped", el: name(el) });
      mark(el);
    } else if (hasText && el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY + cs.overflow) && !cs.webkitLineClamp?.match(/\d/)) {
      found.push({ type: "clipped", el: name(el) });
      mark(el);
    }
    if (el !== root) {
      const r = el.getBoundingClientRect();
      if ((r.right > R.right + 3 || r.left < R.left - 3) && cs.position !== "fixed" && cs.position !== "absolute") {
        if (!found.some((f) => f.type === "spills" && f.el === name(el)) && !el.parentElement.closest("[data-broke]")) {
          found.push({ type: "spills", el: name(el), px: Math.round(Math.max(r.right - R.right, R.left - r.left)) });
          mark(el);
        }
      }
    }
  }
  // overlapping text: leaf elements with text whose boxes cross
  const leaves = all.filter((el) => el !== root && [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())).slice(0, 220);
  const rects = leaves.map((el) => el.getBoundingClientRect());
  for (let i = 0; i < leaves.length; i++)
    for (let j = i + 1; j < leaves.length; j++) {
      if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue;
      const a = rects[i];
      const b = rects[j];
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) {
        found.push({ type: "overlap", el: `${name(leaves[i])} × ${name(leaves[j])}` });
        mark(leaves[i]);
        mark(leaves[j]);
        if (found.filter((f) => f.type === "overlap").length > 5) break;
      }
    }
  // text that ignored the user's font size (set in px)
  for (const el of all) {
    if (!el.dataset.fs || ![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
    if (parseFloat(getComputedStyle(el).fontSize) < Number(el.dataset.fs) * 1.5) {
      found.push({ type: "fixed", el: name(el) });
      mark(el);
    }
  }
  // images that collapsed or left an ugly hole
  for (const im of root.querySelectorAll("img")) {
    const r = im.getBoundingClientRect();
    if (im.complete && im.naturalWidth <= 1 && (r.height < 2 || r.width < 2)) found.push({ type: "collapsed", el: name(im) });
  }
  const sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (sideways > 2) found.push({ type: "sideways", px: sideways });
  const text = root.innerText.trim();
  return { found, height: Math.round(R.height), width: Math.round(R.width), empty: !text && !root.querySelector("img,svg,video,canvas") };
}

// ---------------------------------------------------------------- strings
const T = {
  en: {
    title: "Break test", holds: "holds", breaks: "breaks", look: "look", base: "as it is",
    sc: {
      base: ["As it is", "The component with its real content."],
      long: ["Text 3× longer", "Every text three times its length: a long name, a long title, a real review."],
      word: ["A word that won't wrap", "The longest word replaced by a 42-letter one. URLs, emails and German do this."],
      empty: ["No text", "Every text empty: missing data, a field nobody filled."],
      translate: ["Translated, 40% longer", "Accents everywhere and 40% more words, like a German or Finnish translation."],
      numbers: ["Huge numbers", "Every number becomes 1,234,567.89."],
      names: ["Accents and emoji", "Short texts get “Zoë Ñúñez-O'Brien 🎂”, the name your form will meet."],
      images: ["Images fail", "Every image and background image broken, like a slow CDN or a deleted file."],
      one: ["Only one item", "The list inside the component with a single item."],
      many: ["25 items", "The list inside the component with 25 items."],
      rtl: ["Right to left", "The page in RTL, as in Arabic or Hebrew."],
      narrow: ["320px screen", "The smallest phone, or a laptop at 400% zoom."],
      text200: ["Text at 200%", "The browser font size doubled, as a user with low vision sets it. Text in px does not follow."],
      contrast: ["High contrast", "Windows forced colors: backgrounds and shadows disappear, only borders and text stay."],
      dark: ["Dark mode", "The system in dark mode."],
    },
    what: { fixed: "text ignores the font size setting (px)", clipped: "text cut off", spills: "spills out of the component", overlap: "texts on top of each other", collapsed: "image collapses to nothing", sideways: "page scrolls sideways", same: "looks exactly like the default", nochange: "no list found to change", empty: "shows nothing at all", grows: "grows to" },
    made: "Made by /coleoni-break · skills.coleoni.com",
  },
  pt: {
    title: "Teste de quebra", holds: "aguenta", breaks: "quebra", look: "olhar", base: "como está",
    sc: {
      base: ["Como está", "O componente com o conteúdo real."],
      long: ["Texto 3× maior", "Todo texto com o triplo do tamanho: um nome comprido, um título longo, uma avaliação de verdade."],
      word: ["Palavra que não quebra", "A palavra mais longa vira uma de 42 letras. URL, e-mail e alemão fazem isso."],
      empty: ["Sem texto", "Todo texto vazio: dado que falta, campo que ninguém preencheu."],
      translate: ["Traduzido, 40% maior", "Acento em tudo e 40% mais palavras, como uma tradução pro alemão ou finlandês."],
      numbers: ["Números enormes", "Todo número vira 1,234,567.89."],
      names: ["Acentos e emoji", "Textos curtos ganham “Zoë Ñúñez-O'Brien 🎂”, o nome que o seu formulário vai receber."],
      images: ["Imagens falham", "Toda imagem e imagem de fundo quebrada, como um CDN lento ou um arquivo apagado."],
      one: ["Um item só", "A lista dentro do componente com um item."],
      many: ["25 itens", "A lista dentro do componente com 25 itens."],
      rtl: ["Da direita pra esquerda", "A página em RTL, como em árabe ou hebraico."],
      narrow: ["Tela de 320px", "O menor celular, ou um notebook com zoom de 400%."],
      text200: ["Texto em 200%", "O tamanho de fonte do navegador dobrado, como quem tem baixa visão configura. Texto em px não acompanha."],
      contrast: ["Alto contraste", "Cores forçadas do Windows: fundos e sombras somem, só ficam bordas e texto."],
      dark: ["Modo escuro", "O sistema em modo escuro."],
    },
    what: { fixed: "texto ignora o tamanho de fonte do usuário (px)", clipped: "texto cortado", spills: "vaza pra fora do componente", overlap: "textos um em cima do outro", collapsed: "imagem some sem deixar espaço", sideways: "página rola pro lado", same: "fica igual ao normal", nochange: "nenhuma lista pra mudar", empty: "não mostra nada", grows: "cresce pra" },
    made: "Feito pela /coleoni-break · skills.coleoni.com",
  },
};

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const t = T[o.lang];
const out = resolve(o.out);
mkdirSync(join(out, "shots"), { recursive: true });

let url = o.target;
let server = null;
if (!/^[a-z]+:\/\//i.test(url) && existsSync(resolve(url))) {
  const p = resolve(url);
  const root = statSync(p).isDirectory() ? p : resolve(p, "..");
  server = await serve(root);
  url = `http://127.0.0.1:${server.address().port}/${statSync(p).isDirectory() ? "" : p.slice(root.length + 1).replace(/\\/g, "/")}`;
} else if (!/^[a-z]+:\/\//i.test(url)) url = /^localhost|^127\./.test(url) ? `http://${url}` : `https://${url}`;

const browser = await launch();
const sel = o.select ?? "main";

async function run(kind) {
  const narrow = kind === "narrow";
  const ctx = await browser.newContext({
    viewport: narrow ? { width: 320, height: 720 } : { width: o.width, height: 900 },
    deviceScaleFactor: 2,
    isMobile: narrow,
    hasTouch: narrow,
    reducedMotion: "reduce",
    colorScheme: kind === "dark" ? "dark" : "light",
    forcedColors: kind === "contrast" ? "active" : "none",
    locale: "en-US",
    timezoneId: "UTC",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}html{scroll-behavior:auto!important}" });
  await page.waitForTimeout(o.wait);
  const exists = await page.evaluate((s) => !!document.querySelector(s), sel);
  if (!exists && o.select) fail(`no element matches ${o.select} on ${url}`);
  const m = ["long", "word", "empty", "translate", "numbers", "names", "images", "one", "many", "rtl", "text200"].includes(kind) ? await page.evaluate(mutate, { sel, kind }) : { changed: true };
  await page.waitForTimeout(250);
  const res = await page.evaluate(measure, sel);
  // outline what broke, then crop the component with some room around it
  await page.addStyleTag({ content: "[data-broke]{outline:2.5px solid #ff3b6b!important;outline-offset:1px!important}" });
  const handle = await page.$(sel);
  await handle?.scrollIntoViewIfNeeded().catch(() => {});
  // crop to what the content actually covers (a grid of cards rarely fills its section)
  const box = await page.evaluate((s) => {
    const root = document.querySelector(s) ?? document.querySelector("main") ?? document.body;
    const r = root.getBoundingClientRect();
    let l = Infinity, tp = Infinity, rt = -Infinity, b = -Infinity;
    for (const k of root.children) {
      const q = k.getBoundingClientRect();
      if (q.width < 1 || q.height < 1) continue;
      l = Math.min(l, q.left); tp = Math.min(tp, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
    }
    // viewport coordinates, the same ones page.screenshot's clip uses
    if (!isFinite(l)) return { x: r.left, y: r.top, width: r.width, height: r.height };
    const top = Math.min(tp, r.top);
    return { x: l, y: top, width: rt - l, height: Math.max(b, r.bottom) - top };
  }, sel);
  const vp = page.viewportSize();
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const pad = 20;
  let clip = null;
  if (box) {
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    clip = { x, y, width: Math.min(vp.width - x, box.width + pad * 2 + (narrow ? 0 : 0)), height: Math.min(box.height + pad * 2, 1600, docH - y) };
  }
  const file = `shots/${kind}.jpg`;
  if (clip && clip.width > 10 && clip.height > 10) await page.screenshot({ path: join(out, file), type: "jpeg", quality: 85, clip, fullPage: false }).catch(async () => page.screenshot({ path: join(out, file), type: "jpeg", quality: 85 }));
  else await page.screenshot({ path: join(out, file), type: "jpeg", quality: 85 });
  const shot = readFileSync(join(out, file));
  await ctx.close();
  return { kind, changed: m?.changed !== false, ...res, errors: [...new Set(errors)], file, size: shot.length, bytes: shot };
}

console.log(`breaking ${sel} on ${url}`);
const base = await run("base");
// problems by kind and element, counted, so a scenario only answers for what it added
const tally = (found) => {
  const m = new Map();
  for (const f of found) {
    const k = `${f.type}|${f.el ?? ""}`;
    if (!m.has(k)) m.set(k, { f, n: 0 });
    m.get(k).n++;
  }
  return m;
};
const describe = (list) => {
  const out = [];
  for (const { f, n } of list) {
    if (out.some((x) => x.type === f.type)) {
      out.find((x) => x.type === f.type).extra += n;
      continue;
    }
    out.push({ type: f.type, f, extra: n - 1 });
  }
  return out.map(({ type, f, extra }) => ({ type, text: `${t.what[type]}${f.el ? `: ${f.el}` : ""}${f.px ? `, ${f.px}px` : ""}${extra > 0 ? ` (+${extra})` : ""}` }));
};
const baseTally = tally(base.found);
const baseIssues = describe([...baseTally.values()]);
const results = [];
for (const k of o.scenarios) {
  const r = await run(k);
  const added = [];
  for (const [key, v] of tally(r.found)) {
    const before = baseTally.get(key);
    if (v.f.type === "sideways" && before && v.f.px <= before.f.px + 2) continue;
    const n = v.n - (before?.n ?? 0);
    if (n > 0) added.push({ f: v.f, n });
  }
  const issues = describe(added);
  if (r.errors.length) issues.push({ type: "error", text: r.errors[0] });
  let status = issues.length ? "breaks" : "holds";
  const notes = [];
  if (!r.changed) {
    status = "look";
    notes.push(t.what.nochange);
  }
  if (["dark", "contrast"].includes(k) && r.bytes.equals(base.bytes)) notes.push(t.what.same);
  if (r.empty && k === "empty") {
    status = issues.length ? "breaks" : "look";
    notes.push(t.what.empty);
  }
  if (k === "images" && !issues.length) status = "look";
  if (base.height && r.height > base.height * 2.2 && !["many", "text200", "narrow"].includes(k)) notes.push(`${t.what.grows} ${r.height}px (${(r.height / base.height).toFixed(1)}×)`);
  results.push({ kind: k, status, issues, notes, file: r.file, height: r.height });
  console.log(`  ${k.padEnd(10)} ${status}${issues.length ? "  " + issues.map((i) => i.text).join(" · ") : ""}`);
}
await browser.close();
server?.close();

// ---------------------------------------------------------------- sheet
const broke = results.filter((r) => r.status === "breaks").length;
const site = (() => {
  try {
    const u = new URL(url);
    return u.hostname === "127.0.0.1" ? o.target.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : u.hostname + u.pathname;
  } catch {
    return url;
  }
})();
const cardHtml = (r) => `<article class="${r.status}"><header><b>${esc(t.sc[r.kind][0])}</b><em>${r.kind === "base" ? t.base : t[r.status]}</em></header><p>${esc(t.sc[r.kind][1])}</p><div class="shot"><img src="${r.file}" alt=""></div>${r.issues?.length || r.notes?.length ? `<ul>${(r.issues ?? []).map((i) => `<li class="x">${esc(i.text)}</li>`).join("")}${(r.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</article>`;
const html = `<!doctype html><html lang="${o.lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title} · ${esc(site)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1480px;margin:0 auto;padding:44px 32px 56px;display:grid;gap:28px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:40px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
h1 span{color:#8b8d94}
.sum{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.sum span{border:1px solid #2a2b30;background:#16171a;border-radius:999px;padding:5px 12px;font-size:13px;color:#c9cacf}
.sum b{font-weight:650}.sum .r b{color:#ff8a7d}.sum .g b{color:#aefa0e}
.sum code{font:12.5px ui-monospace,Consolas,monospace;color:#e8e8ea}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px;align-items:start}
article{background:#16171a;border:1px solid #26272b;border-radius:14px;overflow:hidden;display:grid}
article.breaks{border-color:#5a2a26}
header{display:flex;align-items:baseline;gap:10px;padding:13px 15px 0}
header b{font-size:15px;font-weight:620}
header em{margin-left:auto;font-style:normal;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;background:#20300c;color:#aefa0e}
.breaks header em{background:#3a1715;color:#ff8a7d}.look header em{background:#2b2210;color:#ffc861}.base header em{background:#1d1f24;color:#c9cacf}
article>p{color:#8b8d94;font-size:12.5px;padding:3px 15px 10px}
.shot{background:repeating-conic-gradient(#1a1b1f 0 25%,#16171a 0 50%) 0 0/16px 16px;border-top:1px solid #222327;border-bottom:1px solid #222327;display:grid;place-items:center;padding:10px;max-height:460px;overflow:hidden}
.shot img{max-width:100%;max-height:440px;display:block;border-radius:6px}
ul{list-style:none;padding:10px 15px 13px;display:grid;gap:4px}
li{font-size:12.5px;color:#a9abb2;display:flex;gap:8px}
li:before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#6b6d74;margin-top:6px}
li.x{color:#ffb4ab}li.x:before{background:#ff6b5e}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:760px){.w{padding:28px 16px 40px}h1{font-size:28px}}
</style></head><body><div class="w">
<div><span class="k">${t.title} · ${new Date().toISOString().slice(0, 10)}</span><h1>${esc(site)} <span>${esc(sel)}</span></h1>
<div class="sum"><span class="r"><b>${broke}</b> ${o.lang === "pt" ? "cenários quebram" : "scenarios break"}</span><span class="g"><b>${results.filter((r) => r.status === "holds").length}</b> ${o.lang === "pt" ? "aguentam" : "hold"}</span><span><b>${results.filter((r) => r.status === "look").length}</b> ${o.lang === "pt" ? "pra olhar" : "to look at"}</span></div></div>
<div class="grid">${cardHtml({ kind: "base", status: "base", file: base.file, issues: baseIssues, notes: baseIssues.length ? [o.lang === "pt" ? "já quebrado antes de qualquer cenário" : "already broken before any scenario"] : [] })}${results.map(cardHtml).join("")}</div>
<p class="foot">${t.made}</p>
</div></body></html>`;
writeFileSync(join(out, "break.html"), html);
writeFileSync(join(out, "break.json"), JSON.stringify({ url: server ? null : url, select: sel, date: new Date().toISOString(), base: baseIssues, results: results.map(({ ...r }) => r) }, null, 2));
writeFileSync(
  join(out, "break.md"),
  [`# ${t.title}: ${site} · \`${sel}\``, ``, `${broke} / ${results.length} ${o.lang === "pt" ? "cenários quebram" : "scenarios break"}.`, ``, ...results.map((r) => `- **${t.sc[r.kind][0]}**: ${t[r.status]}${r.issues.length ? ". " + r.issues.map((i) => i.text).join("; ") : ""}${r.notes.length ? ` (${r.notes.join("; ")})` : ""}`)].join("\n"),
);
const pv = await (await launch()).newPage({ viewport: { width: 1480, height: 900 } });
await pv.goto(pathToFileURL(join(out, "break.html")).href, { waitUntil: "load" });
await pv.screenshot({ path: join(out, "break.png"), fullPage: true });
await pv.context().browser().close();
console.log(`\n${broke} of ${results.length} scenarios break`);
console.log(`ok ${join(out, "break.html")}`);
