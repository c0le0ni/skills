#!/usr/bin/env node
/**
 * Coleoni · accessibility audit, WCAG 2.2 AA and eMAG 3.1.
 *
 *   node a11y.mjs <url | folder> --out <folder> [--lang en|pt] [--pages 10]
 *
 * For each page: runs axe-core (WCAG 2.0 to 2.2, A and AA, plus best
 * practices), walks the page with the Tab key (focus visible, traps, skip
 * link, focus on hidden elements), checks reflow at 320px and animations that
 * ignore reduced motion, and crops every problem from the page. Writes
 * report.html (in English or Portuguese), report.md, a11y.json and outline.md
 * (headings, landmarks, tab order, images and fields, for the manual pass).
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EMAG, RULE_EMAG, SC } from "./criteria.mjs";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

const HELP = `
node a11y.mjs <url|folder> --out <folder> [options]

  --lang en|pt     language of the report (default en; pt uses eMAG names and axe in Portuguese)
  --pages 10       most pages to audit (sitemap first, then links from the first page)
  --wait 500       extra wait after each page loads, in ms
  --domain site.com  name shown in the report, for local builds
  --no-keyboard    skip the Tab walk
`;

function parseArgs(argv) {
  const o = { target: null, out: "a11y-report", lang: "en", pages: 10, wait: 500, keyboard: true, domain: null };
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
      case "--lang": o.lang = val() === "pt" ? "pt" : "en"; break;
      case "--pages": o.pages = Number(val()); break;
      case "--wait": o.wait = Number(val()); break;
      case "--no-keyboard": o.keyboard = false; break;
      case "--domain": o.domain = val(); break;
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

// ---------------------------------------------------------------- browser and server
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

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json", ".xml": "application/xml" };
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

// ---------------------------------------------------------------- in-page helpers
function outline() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const name = (el) => (el.getAttribute("aria-label") || el.innerText || el.getAttribute("alt") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return {
    title: document.title,
    lang: document.documentElement.lang || null,
    headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(vis).map((h) => ({ level: Number(h.getAttribute("aria-level") || h.tagName[1] || 2), text: name(h) })),
    landmarks: [...document.querySelectorAll("header,nav,main,aside,footer,[role=banner],[role=navigation],[role=main],[role=complementary],[role=contentinfo],[role=search],form[aria-label],section[aria-label],section[aria-labelledby]")].filter(vis).map((l) => ({ tag: l.getAttribute("role") || l.tagName.toLowerCase(), label: l.getAttribute("aria-label") || "" })),
    images: [...document.images].filter(vis).map((i) => ({ src: (i.currentSrc || i.src).split("/").pop().slice(0, 60), alt: i.getAttribute("alt") })),
    fields: [...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter(vis).map((f) => {
      const lab = (f.id && document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) || f.closest("label");
      return { type: f.type || f.tagName.toLowerCase(), label: (lab?.innerText || f.getAttribute("aria-label") || "").trim().slice(0, 60), placeholder: f.placeholder || "" };
    }),
  };
}

// the focused element, and whether focus changes how it looks
function focusInfo() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const pick = (n) => {
    const s = getComputedStyle(n);
    return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine, s.transform].join("|");
  };
  const r = el.getBoundingClientRect();
  const focused = [pick(el), el.parentElement ? pick(el.parentElement) : ""];
  const desc = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.getAttribute("href") ? ` ${el.getAttribute("href")}` : ""}`;
  const label = (el.getAttribute("aria-label") || el.innerText || el.value || el.getAttribute("alt") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  el.blur();
  const plain = [pick(el), el.parentElement ? pick(el.parentElement) : ""];
  el.focus();
  const outlineOn = /solid|dotted|dashed|double|auto/.test(focused[0].split("|")[0]) && parseFloat(focused[0].split("|")[1]) > 0;
  const visible = focused[0] !== plain[0] || focused[1] !== plain[1] || outlineOn;
  const cs = getComputedStyle(el);
  const hidden = r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.opacity === "0" || r.bottom < -5 || r.right < -5 || r.left > innerWidth + 5;
  if (!el.dataset.a11yId) el.dataset.a11yId = String(Math.random()).slice(2, 10);
  return { id: el.dataset.a11yId, desc, label, visible, hidden, href: el.getAttribute("href"), x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
}

// ---------------------------------------------------------------- crops
async function crop(page, selector, file, pad = 22) {
  try {
    const el = await page.$(selector);
    if (!el) return null;
    await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    const box = await el.boundingBox();
    if (!box || box.width < 1 || box.height < 1) return null;
    await el.evaluate((n) => {
      n.dataset.a11yPrev = n.style.outline + "|" + n.style.outlineOffset;
      n.style.outline = "3px solid #ff3b6b";
      n.style.outlineOffset = "3px";
    });
    const vp = page.viewportSize();
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const w = Math.min(vp.width - x, box.width + pad * 2, 900);
    const h = Math.min(vp.height - y, box.height + pad * 2, 420);
    if (w < 10 || h < 10) return null;
    await page.screenshot({ path: file, type: "jpeg", quality: 82, clip: { x, y, width: w, height: h } });
    await el.evaluate((n) => {
      const [o, f] = (n.dataset.a11yPrev ?? "|").split("|");
      n.style.outline = o;
      n.style.outlineOffset = f;
    });
    return true;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- strings
const T = {
  en: {
    title: "Accessibility audit", std: "WCAG 2.2 AA · eMAG 3.1", page: "page", pages: "pages", block: "block people", fix: "to fix", look: "worth a look", passed: "rules passed",
    fixFirst: "Fix first", grouped: "grouped by rule, most serious on top", element: "element", elements: "elements", on: "on", keyboard: "Keyboard", manual: "Still to check by hand",
    sev: { block: "Blocks people", fix: "To fix", look: "Worth a look" }, how: "How to fix", allPages: "Every page",
    kb: { stops: "Tab stops", skip: "Skip link", noFocus: "No visible focus", hiddenFocus: "Focus on hidden elements", trap: "Keyboard trap", yes: "yes", no: "no" },
    manualList: ["Read the page with a screen reader (NVDA, VoiceOver, TalkBack): does the order make sense?", "Alt text says what the image means here, not what it looks like.", "Videos have captions; audio has a transcript.", "Form errors say what went wrong and how to fix it, next to the field.", "Zoom to 200%: nothing is cut, nothing overlaps.", "Every action that works with a mouse also works with the keyboard."],
    note: "Automated checks find part of the problems. The rest needs the manual pass above.",
    made: "Made by /coleoni-a11y · skills.coleoni.com",
  },
  pt: {
    title: "Auditoria de acessibilidade", std: "WCAG 2.2 AA · eMAG 3.1", page: "página", pages: "páginas", block: "impedem o uso", fix: "a corrigir", look: "vale olhar", passed: "regras ok",
    fixFirst: "Corrigir primeiro", grouped: "agrupado por regra, o mais grave no topo", element: "elemento", elements: "elementos", on: "em", keyboard: "Teclado", manual: "Ainda conferir à mão",
    sev: { block: "Impede o uso", fix: "A corrigir", look: "Vale olhar" }, how: "Como corrigir", allPages: "Cada página",
    kb: { stops: "Paradas do Tab", skip: "Link de pular conteúdo", noFocus: "Sem foco visível", hiddenFocus: "Foco em elementos escondidos", trap: "Teclado preso", yes: "sim", no: "não" },
    manualList: ["Ouça a página com leitor de tela (NVDA, VoiceOver, TalkBack): a ordem faz sentido?", "O texto alternativo diz o que a imagem significa ali, não como ela é.", "Vídeos têm legenda; áudios têm transcrição.", "Erros de formulário dizem o que deu errado e como corrigir, do lado do campo.", "Zoom em 200%: nada cortado, nada sobreposto.", "Tudo o que funciona com o mouse funciona com o teclado."],
    note: "Testes automáticos acham parte dos problemas. O resto precisa da conferência manual acima. A Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63) exige acessibilidade nos sites de empresas com sede ou representação no Brasil e de órgãos públicos.",
    made: "Feito pela /coleoni-a11y · skills.coleoni.com",
  },
};

// our own checks, written like axe results
const OWN = {
  "focus-visible": { sc: ["2.4.7"], impact: "serious", en: ["Focus is not visible", "When a keyboard user tabs to these elements, nothing on screen shows where they are.", "Add a :focus-visible style (outline or ring) with at least 3:1 contrast against the background."], pt: ["O foco não aparece", "Quem navega pelo teclado chega nesses elementos e nada na tela mostra onde está.", "Adicione um estilo :focus-visible (contorno ou anel) com contraste de pelo menos 3:1 com o fundo."] },
  "focus-hidden": { sc: ["2.4.3", "2.4.11"], impact: "serious", en: ["Focus lands on hidden elements", "Tab stops on something that is off screen or invisible, so the keyboard user loses their place.", "Remove hidden items from the tab order (hidden, inert or tabindex=-1) until they are shown."], pt: ["O foco cai em elementos escondidos", "O Tab para em algo fora da tela ou invisível, e quem usa teclado se perde.", "Tire os itens escondidos da ordem do Tab (hidden, inert ou tabindex=-1) até eles aparecerem."] },
  "keyboard-trap": { sc: ["2.1.2"], impact: "critical", en: ["Keyboard trap", "Tab stops moving: a keyboard user cannot leave this element.", "Let Tab and Shift+Tab move out, and Esc close any widget that holds focus."], pt: ["Teclado preso", "O Tab para de andar: quem usa teclado não consegue sair desse elemento.", "Deixe Tab e Shift+Tab saírem, e Esc fechar qualquer componente que segure o foco."] },
  "skip-link-missing": { sc: ["2.4.1"], impact: "minor", en: ["No skip link", "The first Tab stop is not a link to the main content, so keyboard users go through the whole menu on every page.", "Add “Skip to content” as the first focusable element, pointing to <main id=\"content\">. eMAG 1.5 asks for it."], pt: ["Sem link de pular conteúdo", "A primeira parada do Tab não é um link pro conteúdo principal, então quem usa teclado passa pelo menu inteiro em toda página.", "Adicione “Ir para o conteúdo” como primeiro elemento focável, apontando pra <main id=\"conteudo\">. O eMAG pede isso na recomendação 1.5."] },
  reflow: { sc: ["1.4.10"], impact: "serious", en: ["Content does not reflow at 320px", "At 320 CSS pixels wide (400% zoom on a laptop) the page scrolls sideways.", "Let the element wrap or shrink: max-width: 100%, flexible grids, overflow-x: auto on tables and code."], pt: ["O conteúdo não se ajusta em 320px", "Com 320 pixels CSS de largura (zoom de 400% num notebook) a página rola pro lado.", "Deixe o elemento quebrar ou encolher: max-width: 100%, grids flexíveis, overflow-x: auto em tabelas e código."] },
  motion: { sc: ["2.3.3", "2.2.2"], impact: "minor", en: ["Animation ignores reduced motion", "With “reduce motion” on in the system, these animations still run. They can cause nausea for people with vestibular disorders.", "Wrap the animation in @media (prefers-reduced-motion: no-preference), or stop it under reduce."], pt: ["A animação ignora o movimento reduzido", "Com “reduzir movimento” ligado no sistema, essas animações continuam. Elas podem causar enjoo em quem tem distúrbio vestibular.", "Coloque a animação dentro de @media (prefers-reduced-motion: no-preference), ou pare ela no modo reduce."] },
};

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const t = T[o.lang];
const out = resolve(o.out);
mkdirSync(join(out, "shots"), { recursive: true });

let base = o.target;
let server = null;
if (!/^[a-z]+:\/\//i.test(base) && existsSync(resolve(base))) {
  const p = resolve(base);
  server = await serve(statSync(p).isDirectory() ? p : resolve(p, ".."));
  base = `http://127.0.0.1:${server.address().port}/${statSync(p).isDirectory() ? "" : p.split(/[\\/]/).pop()}`;
} else if (!/^[a-z]+:\/\//i.test(base)) base = /^localhost|^127\./.test(base) ? `http://${base}` : `https://${base}`;
const origin = new URL(base).origin;

// pages: sitemap first, then links
let queue = [base];
try {
  const r = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
  if (r.ok) {
    const locs = [...(await r.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    const local = locs.map((l) => origin + new URL(l).pathname);
    if (local.length) queue = [base, ...local];
  }
} catch {}
const fromSitemap = queue.length > 1;

const axePath = require.resolve("axe-core/axe.min.js");
const locale = o.lang === "pt" ? JSON.parse(readFileSync(join(dirname(require.resolve("axe-core/package.json")), "locales", "pt_BR.json"), "utf8")) : null;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, bypassCSP: true, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, bypassCSP: true, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });

const pages = [];
const issues = new Map(); // rule -> issue
const seen = new Set();
let passedRules = new Set();
let shotN = 0;

function addIssue(rule, data, pagePath, nodes) {
  if (!issues.has(rule)) issues.set(rule, { rule, ...data, pages: new Set(), nodes: [], count: 0 });
  const it = issues.get(rule);
  it.pages.add(pagePath);
  it.count += nodes.length;
  for (const n of nodes) if (it.nodes.length < 4) it.nodes.push({ ...n, page: pagePath });
}

while (queue.length && pages.length < o.pages) {
  const url = new URL(queue.shift().replace(/#.*$/, "")).href;
  if (seen.has(url)) continue;
  seen.add(url);
  if (/\.(pdf|jpe?g|png|webp|svg|zip|xml|txt)$/i.test(new URL(url).pathname)) continue;
  const page = await ctx.newPage();
  const path = new URL(url).pathname;
  try {
    const r = await page.goto(url, { waitUntil: "load", timeout: 60000 });
    if ([404, 410].includes(r?.status() ?? 0)) throw new Error(`status ${r.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(o.wait);
    const pi = pages.length;
    await page.screenshot({ path: join(out, "shots", `page-${pi}.jpg`), type: "jpeg", quality: 80 });

    // axe
    await page.addScriptTag({ path: axePath });
    const res = await page.evaluate(
      async ({ tags, locale }) => {
        if (locale) window.axe.configure({ locale });
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
        return {
          passes: r.passes.map((p) => p.id),
          violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, description: v.description, tags: v.tags, helpUrl: v.helpUrl, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 200), summary: (n.failureSummary || "").split("\n").slice(1, 3).join(" ").trim() })) })),
        };
      },
      { tags: TAGS, locale },
    );
    for (const p of res.passes) passedRules.add(p);
    for (const v of res.violations) {
      const sc = v.tags.map((x) => x.match(/^wcag(\d)(\d)(\d+)$/)).filter(Boolean).map((m) => `${m[1]}.${m[2]}.${m[3]}`);
      const nodes = [];
      for (const n of v.nodes.slice(0, 3)) {
        const sel = n.target.length === 1 && typeof n.target[0] === "string" ? n.target[0] : null;
        let shot = null;
        if (sel && shotN < 60) {
          const f = `shots/el-${shotN}.jpg`;
          if (await crop(page, sel, join(out, f))) {
            shot = f;
            shotN++;
          }
        }
        nodes.push({ target: n.target.flat().join(" "), html: n.html, summary: n.summary, shot });
      }
      for (const n of v.nodes.slice(3)) nodes.push({ target: n.target.flat().join(" "), html: n.html, summary: n.summary, shot: null });
      addIssue(v.id, { impact: v.impact, title: v.help, detail: v.description, sc, helpUrl: v.helpUrl, best: !sc.length }, path, nodes);
    }

    // outline for the manual pass
    const ol = await page.evaluate(outline);

    // keyboard walk
    const kb = { stops: 0, skip: false, noFocus: [], hidden: [], trap: false, order: [] };
    if (o.keyboard) {
      await page.evaluate(() => {
        scrollTo(0, 0);
        document.activeElement?.blur?.();
      });

      let last = null;
      let same = 0;
      const ids = new Set();
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(i === 0 ? 300 : 60);
        const f = await page.evaluate(focusInfo);
        if (!f) break;
        if (f.id === last) {
          if (++same >= 2) {
            kb.trap = f;
            break;
          }
          continue;
        }
        same = 0;
        last = f.id;
        if (ids.has(f.id)) break; // went round the page
        ids.add(f.id);
        kb.stops++;
        if (kb.order.length < 40) kb.order.push(`${f.desc}${f.label ? ` “${f.label}”` : ""}`);
        if (i === 0 && f.href?.startsWith("#") && /skip|pular|ir para|conte[uú]do|content|main/i.test(f.label)) kb.skip = true;
        if (f.hidden) kb.hidden.push(f);
        else if (!f.visible) {
          if (kb.noFocus.length < 12) {
            let shot = null;
            if (shotN < 60 && kb.noFocus.length < 3) {
              const file = `shots/el-${shotN}.jpg`;
              if (await crop(page, `[data-a11y-id="${f.id}"]`, join(out, file))) {
                shot = file;
                shotN++;
              }
            }
            kb.noFocus.push({ ...f, shot });
          }
        }
      }
      const loc = (f) => ({ target: f.desc, html: f.label, summary: "", shot: f.shot ?? null });
      if (kb.noFocus.length) addIssue("focus-visible", { ...OWN["focus-visible"], title: OWN["focus-visible"][o.lang][0], detail: OWN["focus-visible"][o.lang][1], fixText: OWN["focus-visible"][o.lang][2] }, path, kb.noFocus.map(loc));
      if (kb.hidden.length) addIssue("focus-hidden", { ...OWN["focus-hidden"], title: OWN["focus-hidden"][o.lang][0], detail: OWN["focus-hidden"][o.lang][1], fixText: OWN["focus-hidden"][o.lang][2] }, path, kb.hidden.map(loc));
      if (kb.trap) addIssue("keyboard-trap", { ...OWN["keyboard-trap"], title: OWN["keyboard-trap"][o.lang][0], detail: OWN["keyboard-trap"][o.lang][1], fixText: OWN["keyboard-trap"][o.lang][2] }, path, [loc(kb.trap)]);
      if (kb.stops > 6 && !kb.skip) addIssue("skip-link-missing", { ...OWN["skip-link-missing"], title: OWN["skip-link-missing"][o.lang][0], detail: OWN["skip-link-missing"][o.lang][1], fixText: OWN["skip-link-missing"][o.lang][2] }, path, [{ target: kb.order[0] ?? "", html: "", summary: "", shot: null }]);
    }

    // animations that keep running with reduced motion on
    const anims = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running" && (a.effect?.getTiming?.().iterations === Infinity || Number(a.effect?.getTiming?.().duration) > 1000))
        .map((a) => {
          const el = a.effect?.target;
          return el ? `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""}` : "?";
        })
        .slice(0, 5),
    );
    if (anims.length) addIssue("motion", { ...OWN.motion, title: OWN.motion[o.lang][0], detail: OWN.motion[o.lang][1], fixText: OWN.motion[o.lang][2] }, path, anims.map((a) => ({ target: a, html: "", summary: "", shot: null })));

    // reflow at 320px
    const np = await narrow.newPage();
    await np.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => {});
    await np.waitForTimeout(300);
    const flow = await np.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const extra = document.documentElement.scrollWidth - w;
      if (extra <= 2) return null;
      const el = [...document.querySelectorAll("body *")].find((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.right > w + 2 && r.width > 0 && cs.position !== "fixed" && !e.closest("pre, code, table, [style*=overflow]");
      });
      return { extra, el: el ? el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : "") : null };
    });
    if (flow) {
      const f = `shots/reflow-${pi}.jpg`;
      await np.screenshot({ path: join(out, f), type: "jpeg", quality: 80 });
      addIssue("reflow", { ...OWN.reflow, title: OWN.reflow[o.lang][0], detail: OWN.reflow[o.lang][1], fixText: OWN.reflow[o.lang][2] }, path, [{ target: `${flow.el ?? "page"} · +${flow.extra}px`, html: "", summary: "", shot: f }]);
    }
    await np.close();

    pages.push({ url, path, outline: ol, keyboard: { stops: kb.stops, skip: kb.skip, noFocus: kb.noFocus.length, hidden: kb.hidden.length, trap: !!kb.trap, order: kb.order }, shot: `shots/page-${pi}.jpg` });
    console.log(`  ${path}  ${res.violations.length} rules failing, ${kb.stops} tab stops`);
    if (!fromSitemap) {
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
      for (const l of links) if (l.startsWith(origin)) queue.push(l);
    }
  } catch (e) {
    console.log(`  skipped ${path}: ${e.message.split("\n")[0]}`);
  }
  await page.close();
}
await browser.close();
server?.close();
if (!pages.length) fail("no page could be audited");

// ---------------------------------------------------------------- severity and eMAG
const sevOf = (it) => (it.impact === "critical" || it.impact === "serious" ? (it.best ? "fix" : "block") : it.impact === "moderate" ? "fix" : "look");
const list = [...issues.values()].map((it) => {
  const emag = RULE_EMAG[it.rule] ?? [...new Set(it.sc.flatMap((s) => SC[s]?.[3] ?? []))];
  return { ...it, pages: [...it.pages], sev: sevOf(it), emag };
});
const rank = { block: 0, fix: 1, look: 2 };
list.sort((a, b) => rank[a.sev] - rank[b.sev] || b.count - a.count);
const counts = { block: 0, fix: 0, look: 0 };
for (const it of list) counts[it.sev]++;
for (const it of list) passedRules.delete(it.rule);

// ---------------------------------------------------------------- report
const scChip = (s) => (SC[s] ? `<span class="sc">${s} ${esc(o.lang === "pt" ? SC[s][1] : SC[s][0])} <i>${SC[s][2]}</i></span>` : `<span class="sc">${s}</span>`);
const emagChip = (e) => `<span class="em" title="${esc(EMAG[e]?.[o.lang === "pt" ? 1 : 0] ?? "")}">eMAG ${e}</span>`;
const site = o.domain ?? (new URL(base).host.startsWith("127.0.0.1") ? o.target.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : new URL(base).host);
const card = (it) => `<li class="${it.sev}"><div class="hd"><i></i><b>${esc(it.title)}</b><em>${t.sev[it.sev]}</em></div>
<p>${esc(it.detail)}</p>
<div class="chips">${it.sc.map(scChip).join("")}${it.emag.map(emagChip).join("")}${it.best ? `<span class="sc">best practice</span>` : ""}<span class="cnt">${it.count} ${it.count === 1 ? t.element : t.elements} ${t.on} ${it.pages.length > 2 ? `${it.pages.length} ${t.pages}` : it.pages.join(", ")}</span></div>
${it.nodes.some((n) => n.shot) ? `<div class="crops">${it.nodes.filter((n) => n.shot).slice(0, 3).map((n) => `<figure><img src="${n.shot}" alt=""><figcaption>${esc(n.target).slice(0, 90)}</figcaption></figure>`).join("")}</div>` : `<code class="tg">${esc(it.nodes.slice(0, 3).map((n) => n.target).join(" · ")).slice(0, 220)}</code>`}
<div class="how"><small>${t.how}</small>${esc(it.fixText ?? it.nodes.find((n) => n.summary)?.summary ?? "")}${it.helpUrl ? ` <a href="${esc(it.helpUrl)}">${o.lang === "pt" ? "Detalhes" : "Details"}</a>` : ""}</div></li>`;
const kbRows = pages.map((p) => `<tr><td><code>${esc(p.path)}</code></td><td>${p.keyboard.stops}</td><td class="${p.keyboard.skip ? "ok" : "no"}">${p.keyboard.skip ? t.kb.yes : t.kb.no}</td><td class="${p.keyboard.noFocus ? "no" : "ok"}">${p.keyboard.noFocus}</td><td class="${p.keyboard.hidden ? "no" : "ok"}">${p.keyboard.hidden}</td><td class="${p.keyboard.trap ? "no" : "ok"}">${p.keyboard.trap ? t.kb.yes : t.kb.no}</td></tr>`).join("");
const html = `<!doctype html><html lang="${o.lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title} · ${esc(site)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14.5px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1200px;margin:0 auto;padding:48px 32px 64px;display:grid;gap:36px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:42px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
h1 span{color:#8b8d94}
h2{font-size:22px;font-weight:620;letter-spacing:-.01em;display:flex;gap:10px;align-items:baseline}
h2 small{font-size:13px;color:#8b8d94;font-weight:500}
section{display:grid;gap:14px}
.nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#26272b;border:1px solid #26272b;border-radius:14px;overflow:hidden}
.nums div{background:#151619;padding:16px 18px;display:grid;gap:2px}
.nums b{font-size:28px;font-weight:650;letter-spacing:-.02em}
.nums span{color:#8b8d94;font-size:13px}
.nums .r b{color:#ff8a7d}.nums .y b{color:#ffc861}.nums .g b{color:#aefa0e}
ul{list-style:none;padding:0;display:grid;gap:12px}
li{background:#16171a;border:1px solid #26272b;border-radius:14px;padding:16px 18px;display:grid;gap:10px}
.hd{display:flex;gap:12px;align-items:baseline}
.hd i{width:9px;height:9px;border-radius:50%;flex:none;background:#6b6d74;transform:translateY(-1px)}
li.block .hd i{background:#ff6b5e}li.fix .hd i{background:#f5b84a}
.hd b{font-size:15.5px;font-weight:600}
.hd em{margin-left:auto;font-style:normal;font-size:12px;color:#7c7e85;white-space:nowrap}
li.block .hd em{color:#ff8a7d}li.fix .hd em{color:#ffc861}
li>p{color:#a9abb2}
.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sc,.em{font-size:12px;border-radius:999px;padding:2px 9px;background:#1d1f24;color:#c9cacf;border:1px solid #2a2c31}
.sc i{font-style:normal;color:#8b8d94;margin-left:3px}
.em{background:#18200c;border-color:#2c3a16;color:#c7e48a}
.cnt{font-size:12px;color:#7c7e85;margin-left:4px}
.crops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.crops figure{display:grid;gap:5px;align-content:start}
.crops img{display:block;max-width:100%;max-height:170px;width:auto;border:1px solid #26272b;border-radius:8px}
figcaption,.tg{font:11.5px ui-monospace,"SF Mono",Consolas,monospace;color:#7c7e85;overflow-wrap:anywhere}
.how{font-size:13.5px;color:#c9cacf;border-top:1px solid #222327;padding-top:10px}
.how small{display:block;font:600 11px system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#7c7e85;margin-bottom:2px}
.how a{color:#aefa0e}
table{width:100%;border-collapse:collapse;background:#151619;border:1px solid #26272b;border-radius:14px;overflow:hidden;font-size:13.5px}
th,td{text-align:left;padding:10px 14px;border-top:1px solid #222327}
th{font-weight:600;color:#8b8d94;font-size:12px;border-top:0}
td.ok{color:#aefa0e}td.no{color:#ff8a7d}
code{font:12.5px ui-monospace,"SF Mono",Consolas,monospace}
.man{display:grid;gap:8px;padding:0}
.man li{flex-direction:row;display:flex;gap:12px;padding:12px 16px}
.man li:before{content:"";width:14px;height:14px;border:1.5px solid #4a4c52;border-radius:4px;flex:none;margin-top:3px}
.note{color:#8b8d94;font-size:13px}
.pgs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pgs figure{display:grid;gap:6px}.pgs img{width:100%;border-radius:10px;border:1px solid #26272b}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:820px){.w{padding:32px 18px 48px}h1{font-size:30px}.nums{grid-template-columns:repeat(2,minmax(0,1fr))}.crops,.pgs{grid-template-columns:minmax(0,1fr)}table{display:block;overflow-x:auto}}
</style></head><body><div class="w">
<header><span class="k">${t.title} · ${t.std} · ${new Date().toISOString().slice(0, 10)}</span><h1>${esc(site)} <span>${pages.length} ${pages.length === 1 ? t.page : t.pages}</span></h1></header>
<div class="nums"><div class="r"><b>${counts.block}</b><span>${t.block}</span></div><div class="y"><b>${counts.fix}</b><span>${t.fix}</span></div><div><b>${counts.look}</b><span>${t.look}</span></div><div class="g"><b>${passedRules.size}</b><span>${t.passed}</span></div></div>
${list.length ? `<section><h2>${t.fixFirst} <small>${t.grouped}</small></h2><ul>${list.map(card).join("")}</ul></section>` : ""}
${o.keyboard ? `<section><h2>${t.keyboard}</h2><table><tr><th></th><th>${t.kb.stops}</th><th>${t.kb.skip}</th><th>${t.kb.noFocus}</th><th>${t.kb.hiddenFocus}</th><th>${t.kb.trap}</th></tr>${kbRows}</table></section>` : ""}
<section><h2>${t.manual}</h2><ul class="man">${t.manualList.map((m) => `<li>${esc(m)}</li>`).join("")}</ul><p class="note">${esc(t.note)}</p></section>
<section><h2>${t.allPages}</h2><div class="pgs">${pages.map((p) => `<figure><img src="${p.shot}" alt=""><figcaption>${esc(p.path)}</figcaption></figure>`).join("")}</div></section>
<p class="foot">${t.made}</p>
</div></body></html>`;
writeFileSync(join(out, "report.html"), html);

// markdown, json, outline
const md = [
  `# ${t.title}: ${site}`,
  ``,
  `${t.std}. ${pages.length} ${t.pages}. ${counts.block} ${t.block}, ${counts.fix} ${t.fix}, ${counts.look} ${t.look}, ${passedRules.size} ${t.passed}.`,
  ``,
  ...list.flatMap((it) => [`## [${t.sev[it.sev]}] ${it.title}`, ``, `${it.detail}`, ``, `- WCAG: ${it.sc.map((s) => `${s} ${SC[s]?.[o.lang === "pt" ? 1 : 0] ?? ""} (${SC[s]?.[2] ?? "?"})`).join(", ") || "best practice"}`, `- eMAG: ${it.emag.map((e) => `${e} ${EMAG[e]?.[o.lang === "pt" ? 1 : 0] ?? ""}`).join(", ") || "-"}`, `- ${it.count} ${t.elements} ${t.on} ${it.pages.join(", ")}`, ...it.nodes.slice(0, 4).map((n) => `  - \`${n.target}\`${n.html ? ` ${n.html.replace(/\s+/g, " ").slice(0, 120)}` : ""}`), `- ${t.how}: ${it.fixText ?? it.nodes.find((n) => n.summary)?.summary ?? ""}${it.helpUrl ? ` (${it.helpUrl})` : ""}`, ``]),
  `## ${t.manual}`,
  ``,
  ...t.manualList.map((m) => `- [ ] ${m}`),
  ``,
  t.note,
].join("\n");
writeFileSync(join(out, "report.md"), md);
writeFileSync(join(out, "a11y.json"), JSON.stringify({ site, standard: "WCAG 2.2 AA + eMAG 3.1", date: new Date().toISOString(), counts, passed: [...passedRules], issues: list, pages: pages.map(({ outline, ...p }) => p) }, null, 2));
writeFileSync(
  join(out, "outline.md"),
  pages
    .map((p) =>
      [
        `# ${p.path}`,
        ``,
        `title: ${p.outline.title || "(none)"} · lang: ${p.outline.lang || "(none)"}`,
        ``,
        `## Headings`,
        ...p.outline.headings.map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}- h${h.level} ${h.text}`),
        ``,
        `## Landmarks`,
        p.outline.landmarks.map((l) => `${l.tag}${l.label ? ` (${l.label})` : ""}`).join(" · ") || "(none)",
        ``,
        `## Tab order`,
        ...p.keyboard.order.map((x, i) => `${i + 1}. ${x}`),
        ``,
        `## Images`,
        ...p.outline.images.map((i) => `- ${i.src}: ${i.alt === null ? "NO ALT" : i.alt === "" ? '(alt="" decorative)' : `“${i.alt}”`}`),
        ``,
        `## Fields`,
        ...(p.outline.fields.length ? p.outline.fields.map((f) => `- ${f.type}: ${f.label ? `label “${f.label}”` : "NO LABEL"}${f.placeholder ? ` · placeholder “${f.placeholder}”` : ""}`) : ["(none)"]),
        ``,
      ].join("\n"),
    )
    .join("\n"),
);
console.log(`\n${counts.block} ${t.block}, ${counts.fix} ${t.fix}, ${counts.look} ${t.look}, ${passedRules.size} ${t.passed}`);
console.log(`ok ${join(out, "report.html")}`);
