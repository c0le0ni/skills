#!/usr/bin/env node
/**
 * Coleoni · thumbnails de portfólio a partir de capturas reais de um site.
 *
 *   node thumb.mjs <url> [opções]
 *
 * Captura (Chrome instalado, 2×): primeira tela do desktop, topo da página,
 * cada seção, e três telas do celular. Extrai a paleta do site. Depois monta
 * as artes em HTML (layouts × fundos) e renderiza JPG em 1× e 2×.
 * Opções e catálogo: veja ../SKILL.md ou rode com --help.
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LAYOUTS = ["split", "devices", "wall", "phones", "focus", "tilt"];
const BACKGROUNDS = ["auto", "dark", "brand", "mesh", "grid", "blur"];
const DEFAULT_SET = [
  ["split", "auto"],
  ["devices", "dark"],
  ["wall", "mesh"],
  ["phones", "brand"],
];
const DEFAULT_FRAME = { split: "plain", devices: "browser", wall: "plain", phones: "plain", focus: "browser", tilt: "plain" };

const HELP = `
node thumb.mjs <url> [opções]

  --set split:auto,phones:dark   pares layout:fundo (prioridade sobre --layouts/--bg)
  --layouts split,wall           layouts (combina com cada fundo de --bg)
  --bg auto,dark,#1f2a24         fundos (nomes ou cor hex)
  --frame plain|browser          moldura das telas de desktop (padrão por layout)
  --size 1536x1024               tamanho da arte em 1× (2× sai junto)
  --out ./portfolio-thumbs       pasta de saída
  --name meu-projeto             prefixo dos arquivos (padrão: título do site)
  --label marianaalves.com.br    texto da barra do navegador (padrão: o host; vazio em localhost)
  --phone-at 0,0.3,0.62          trechos da página nos três celulares (fração da altura; encaixa no início da seção mais próxima)
  --column 2,3,5                 índices das seções na coluna/parede (padrão: todas depois da 1ª)
  --hide ".cookie,#chat"         seletores escondidos nas capturas (banners, chats, botões flutuantes)
  --force-visible                força visíveis elementos de animação de entrada (AOS, reveal…)
  --motion                       captura sem movimento reduzido (padrão: reduzido)
  --wait 800                     espera extra (ms) antes de capturar
  --desktop 1440x900 --mobile 390x844   viewports
  --reuse                        reaproveita as capturas anteriores (só recompõe)

Layouts: ${LAYOUTS.join(", ")}
Fundos:  ${BACKGROUNDS.join(", ")}, ou #hex
`;

// ---------------------------------------------------------------- argumentos
function parseArgs(argv) {
  const o = {
    url: null,
    pairs: null,
    layouts: null,
    bgs: null,
    frame: null,
    size: "1536x1024",
    out: "portfolio-thumbs",
    name: null,
    column: null,
    hide: [],
    forceVisible: false,
    motion: false,
    wait: 800,
    desktop: "1440x900",
    mobile: "390x844",
    reuse: false,
    label: null,
    phoneAt: [0, 0.3, 0.62],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? "";
    if (!a.startsWith("--")) {
      o.url = a;
      continue;
    }
    switch (a) {
      case "--help":
        console.log(HELP);
        process.exit(0);
      case "--set":
        o.pairs = val().split(",").map((p) => p.split(":"));
        break;
      case "--layout":
      case "--layouts":
        o.layouts = val().split(",");
        break;
      case "--bg":
      case "--bgs":
        o.bgs = val().split(",");
        break;
      case "--frame":
        o.frame = val();
        break;
      case "--size":
        o.size = val();
        break;
      case "--out":
        o.out = val();
        break;
      case "--name":
        o.name = val();
        break;
      case "--column":
        o.column = val().split(",").map(Number);
        break;
      case "--hide":
        o.hide = val().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--force-visible":
        o.forceVisible = true;
        break;
      case "--motion":
        o.motion = true;
        break;
      case "--wait":
        o.wait = Number(val());
        break;
      case "--desktop":
        o.desktop = val();
        break;
      case "--mobile":
        o.mobile = val();
        break;
      case "--reuse":
        o.reuse = true;
        break;
      case "--label":
        o.label = val();
        break;
      case "--phone-at":
        o.phoneAt = val().split(",").map(Number);
        break;
      default:
        console.error(`opção desconhecida: ${a}`);
        process.exit(1);
    }
  }
  if (!o.url) {
    console.log(HELP);
    process.exit(1);
  }
  return o;
}

const wh = (s) => s.split("x").map(Number);
const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site";

// ---------------------------------------------------------------- navegador
async function launch() {
  const tries = [{ channel: "chrome" }, { channel: "msedge" }];
  if (process.env.CHROME_PATH) tries.unshift({ executablePath: process.env.CHROME_PATH });
  for (const t of tries) {
    try {
      return await chromium.launch(t);
    } catch {}
  }
  throw new Error("Chrome/Edge não encontrado. Defina CHROME_PATH com o executável do Chrome.");
}

const FORCE_VISIBLE = `[data-aos],[data-sal],[data-scroll],.aos-init,.aos-animate,.reveal,.fade-in,.fade-up,.wow,[class*="animate__"]{opacity:1!important;transform:none!important;visibility:visible!important;animation:none!important;transition:none!important}`;

async function prepare(page, url, o) {
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const hide = o.hide.length ? `${o.hide.join(",")}{display:none!important}` : "";
  await page.addStyleTag({
    content: `html{scrollbar-gutter:auto!important;scrollbar-width:none!important;scroll-behavior:auto!important}::-webkit-scrollbar{display:none!important}${hide}${o.forceVisible ? FORCE_VISIBLE : ""}`,
  });
  // carrega imagens preguiçosas e dispara animações de entrada rolando a página toda
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    const step = Math.round(innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo({ top: 0, behavior: "instant" });
    await document.fonts?.ready;
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(o.wait);
}

/** Blocos de primeiro nível da página (seções), na ordem, sem sobreposição */
function findSections(minHeight) {
  const H = document.documentElement.scrollHeight;
  let kids = [...(document.querySelector("main") ?? document.body).children];
  for (let guard = 0; guard < 6; guard++) {
    const vis = kids.filter((k) => k.getBoundingClientRect().height > minHeight);
    if (vis.length === 1 && vis[0].getBoundingClientRect().height > H * 0.6) kids = [...vis[0].children];
    else break;
  }
  const footer = document.querySelector("footer");
  if (footer && !kids.some((k) => k === footer || k.contains(footer))) kids.push(footer);
  const rows = kids
    .filter((k) => {
      const cs = getComputedStyle(k);
      return cs.position !== "fixed" && cs.display !== "none" && k.getBoundingClientRect().height > minHeight;
    })
    .map((k) => {
      const r = k.getBoundingClientRect();
      return { top: Math.round(r.top + scrollY), height: Math.round(r.height), tag: k.tagName.toLowerCase() };
    })
    .sort((a, b) => a.top - b.top);
  const out = [];
  for (const r of rows) {
    const prev = out.at(-1);
    if (prev && r.top < prev.top + prev.height - 4) continue;
    out.push(r);
  }
  return out;
}

/** Paleta: fundo, texto e cor de destaque (a cor de fundo mais comum em botões/links) */
function readPalette() {
  const clear = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
  let bg = getComputedStyle(document.body).backgroundColor;
  if (clear(bg)) bg = getComputedStyle(document.documentElement).backgroundColor;
  if (clear(bg)) bg = "rgb(255, 255, 255)";
  const text = getComputedStyle(document.body).color;
  const counts = new Map();
  for (const el of document.querySelectorAll("a, button, [class*=btn], [class*=button]")) {
    const c = getComputedStyle(el).backgroundColor;
    if (clear(c)) continue;
    const [r, g, b] = c.match(/[\d.]+/g).map(Number);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 14 && (max > 225 || max < 40)) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const accent = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? text;
  return { bg, text, accent, title: document.title };
}

async function capture(o, dir) {
  const browser = await launch();
  const [dw, dh] = wh(o.desktop);
  const [mw, mh] = wh(o.mobile);
  const reducedMotion = o.motion ? "no-preference" : "reduce";
  const meta = { url: o.url, desktop: { w: dw, h: dh }, mobile: { w: mw, h: mh } };

  // desktop
  {
    const ctx = await browser.newContext({ viewport: { width: dw, height: dh }, deviceScaleFactor: 2, reducedMotion });
    const page = await ctx.newPage();
    await prepare(page, o.url, o);
    meta.palette = await page.evaluate(readPalette);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: join(dir, "desktop-hero.png") });
    await page.screenshot({ path: join(dir, "desktop-top.png"), fullPage: true, clip: { x: 0, y: 0, width: dw, height: Math.min(total, Math.round(dh * 1.8)) } });
    const sections = await page.evaluate(findSections, 80);
    meta.sections = [];
    for (const [i, s] of sections.entries()) {
      const height = Math.min(s.height, 4000);
      const file = `section-${String(i).padStart(2, "0")}.png`;
      await page.screenshot({ path: join(dir, file), fullPage: true, clip: { x: 0, y: s.top, width: dw, height } });
      meta.sections.push({ file, top: s.top, height, tag: s.tag });
    }
    await ctx.close();
  }

  // celular: primeira tela + duas telas no meio da página, começando em seções
  {
    const ctx = await browser.newContext({
      viewport: { width: mw, height: mh },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion,
    });
    const page = await ctx.newPage();
    await prepare(page, o.url, o);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const secs = await page.evaluate(findSections, 60);
    const pick = (f) => secs.reduce((best, s) => (Math.abs(s.top - total * f) < Math.abs(best - total * f) ? s.top : best), Math.round(total * f));
    const offsets = [...o.phoneAt, 0.3, 0.62].slice(0, 3).map((f) => (f > 0 ? pick(f) : 0)).map((y) => Math.max(0, Math.min(y, total - mh)));
    meta.phones = [];
    for (const [i, y] of offsets.entries()) {
      const file = `mobile-${i}.png`;
      await page.screenshot({ path: join(dir, file), fullPage: true, clip: { x: 0, y, width: mw, height: mh } });
      meta.phones.push(file);
    }
    await ctx.close();
  }

  await browser.close();
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  return meta;
}

// ---------------------------------------------------------------- cores
const rgb = (s) => {
  if (s.startsWith("#")) {
    const h = s.length === 4 ? [...s.slice(1)].map((c) => c + c).join("") : s.slice(1);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const [r, g, b] = s.match(/[\d.]+/g).map(Number);
  return { r, g, b };
};
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const css = (c, alpha = 1) => `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}${alpha < 1 ? ` / ${alpha}` : ""})`;
const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

/** Fundo da arte + se ele é escuro (muda sombras e borda das molduras) */
function background(name, pal) {
  const page = rgb(pal.bg);
  const text = rgb(pal.text);
  const accent = rgb(pal.accent);
  const pageDark = lum(page) < 0.35;
  const soft = (base) => {
    const light = mix(base, WHITE, 0.22);
    const edge = mix(base, BLACK, 0.06);
    return { css: `radial-gradient(120% 90% at 38% 40%, ${css(light)} 0%, ${css(base)} 60%, ${css(edge)} 100%)`, dark: lum(base) < 0.4 };
  };
  switch (name) {
    case "auto":
      return soft(pageDark ? mix(page, WHITE, 0.07) : mix(page, text, 0.07));
    case "dark": {
      const base = mix({ r: 17, g: 17, b: 19 }, accent, 0.1);
      return {
        css: `radial-gradient(90% 80% at 42% 38%, ${css(mix(base, WHITE, 0.07))} 0%, ${css(base)} 55%, ${css(mix(base, BLACK, 0.45))} 100%)`,
        dark: true,
      };
    }
    case "brand":
      return soft(accent);
    case "mesh": {
      const base = pageDark ? mix(page, WHITE, 0.05) : mix(page, WHITE, 0.35);
      const glow = mix(accent, WHITE, 0.45);
      return {
        css: [
          `radial-gradient(42% 55% at 12% 18%, ${css(accent, 0.34)} 0%, transparent 70%)`,
          `radial-gradient(48% 60% at 88% 84%, ${css(glow, 0.5)} 0%, transparent 72%)`,
          `radial-gradient(36% 46% at 84% 12%, ${css(text, 0.07)} 0%, transparent 70%)`,
          `radial-gradient(40% 50% at 20% 92%, ${css(mix(accent, text, 0.3), 0.16)} 0%, transparent 70%)`,
          css(base),
        ].join(","),
        dark: pageDark,
      };
    }
    case "grid": {
      const base = pageDark ? mix(page, WHITE, 0.06) : mix(page, text, 0.05);
      return {
        css: `radial-gradient(circle at 1px 1px, ${css(text, pageDark ? 0.18 : 0.14)} 1px, transparent 1.4px) 0 0 / 22px 22px, ${soft(base).css}`,
        dark: pageDark,
      };
    }
    case "blur":
      return { css: "#141414", dark: true, photo: true };
    default:
      if (/^#[0-9a-f]{3,6}$/i.test(name)) return soft(rgb(name));
      throw new Error(`fundo desconhecido: ${name}`);
  }
}

// ---------------------------------------------------------------- composição
const img = (file, cls = "shot") => `<img class="${cls}" src="${file}" alt="">`;
const stack = (files) => `<div class="stack">${files.map((f) => `<img src="${f}" alt="">`).join("")}</div>`;

function desktopFrame(style, content, host, attrs) {
  if (style === "browser") {
    return `<div class="frame browser" ${attrs}><div class="bar"><i></i><i></i><i></i><span class="url">${host}</span></div><div class="view">${content}</div></div>`;
  }
  return `<div class="frame" ${attrs}>${content}</div>`;
}

const phone = (file, attrs) =>
  `<div class="phone" ${attrs}><div class="bezel"><div class="screen"><div class="status"><b></b></div><div class="view">${img(file)}</div></div></div></div>`;

/** Divide as seções em n grupos de altura parecida */
function groups(sections, n) {
  const total = sections.reduce((s, x) => s + x.height, 0);
  const out = Array.from({ length: n }, () => []);
  let acc = 0;
  for (const s of sections) {
    const g = Math.min(n - 1, Math.floor((acc / total) * n));
    out[g].push(s.file);
    acc += s.height;
  }
  return out.map((g, i) => (g.length ? g : [sections[i % sections.length].file]));
}

function layoutHtml(layout, meta, frame, host, columnSections) {
  const f = frame ?? DEFAULT_FRAME[layout];
  const col = columnSections.map((s) => s.file);
  switch (layout) {
    case "split":
      return (
        desktopFrame(f, img("desktop-top.png"), host, `id="desk"`) +
        `<div class="frame" id="col">${stack(col)}</div>`
      );
    case "devices":
      return desktopFrame(f, img("desktop-hero.png"), host, `id="win"`) + phone(meta.phones[0], `id="ph"`);
    case "wall": {
      const [a, b, c] = groups(columnSections, 3);
      return [
        ["w1", ["desktop-hero.png", ...a]],
        ["w2", b],
        ["w3", c],
      ]
        .map(([id, files]) => `<div class="frame strip" id="${id}">${stack(files)}</div>`)
        .join("");
    }
    case "phones":
      return phone(meta.phones[1], `id="p1"`) + phone(meta.phones[2], `id="p3"`) + phone(meta.phones[0], `id="p2"`);
    case "focus":
      return desktopFrame(f, img("desktop-hero.png"), host, `id="one"`);
    case "tilt": {
      const [a, b, c] = groups(columnSections, 3);
      const strips = [["desktop-hero.png", ...c], ["desktop-top.png", ...a], b, [...c, ...a]];
      return `<div id="tilt">${strips.map((s) => `<div class="frame strip">${stack(s)}</div>`).join("")}</div>`;
    }
    default:
      throw new Error(`layout desconhecido: ${layout}`);
  }
}

function pageHtml({ layout, bg, meta, frame, host, columnSections }) {
  const pal = meta.palette;
  const page = rgb(pal.bg);
  const shadowTint = mix(rgb(pal.text), BLACK, 0.4);
  const shadow = bg.dark
    ? `0 0 0 1px rgb(255 255 255 / 0.06), 0 18px 40px -14px rgb(0 0 0 / 0.55), 0 50px 110px -40px rgb(0 0 0 / 0.7)`
    : `0 1px 2px ${css(shadowTint, 0.08)}, 0 12px 28px -10px ${css(shadowTint, 0.18)}, 0 40px 80px -30px ${css(shadowTint, 0.28)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100vw;height:100vh;overflow:hidden}
body{position:relative;background:${bg.css};--page:${css(page)};--shadow:${shadow};--r:min(1.25vmin,14px)}
.bgshot{position:absolute;inset:-10%;width:120%;height:120%;object-fit:cover;filter:blur(46px) saturate(1.15) brightness(.55)}
.vignette{position:absolute;inset:0;background:radial-gradient(100% 85% at 50% 45%,transparent 40%,rgb(0 0 0/.45) 100%)}
.frame{position:absolute;overflow:hidden;background:var(--page);border-radius:var(--r);box-shadow:var(--shadow)}
.shot{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}
.stack img{display:block;width:100%;height:auto}
.browser{display:flex;flex-direction:column;container-type:inline-size}
.browser .bar{flex:none;height:3.3cqw;display:flex;align-items:center;gap:.7cqw;padding:0 1.4cqw;background:#f1f0ee;border-bottom:1px solid rgb(0 0 0/.07);position:relative}
.browser .bar i{width:.9cqw;height:.9cqw;border-radius:50%;background:#ff5f57}
.browser .bar i:nth-child(2){background:#febc2e}.browser .bar i:nth-child(3){background:#28c840}
.browser .url{position:absolute;left:50%;transform:translateX(-50%);height:2cqw;min-width:28cqw;padding:0 2cqw;border-radius:1cqw;background:#fff;color:#6b6b6b;font:500 1cqw/2cqw system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;white-space:nowrap}
.browser .view{flex:1;min-height:0;overflow:hidden}
.phone{position:absolute;aspect-ratio:410/864;container-type:inline-size}
.phone .bezel{position:absolute;inset:0;border-radius:15cqw;background:#0e0e10;padding:2.6cqw;box-shadow:var(--shadow),inset 0 0 0 .5cqw #2a2a2e}
.phone .screen{width:100%;height:100%;border-radius:12.5cqw;overflow:hidden;background:var(--page);display:flex;flex-direction:column}
.phone .status{flex:none;height:11cqw;position:relative;background:var(--page)}
.phone .status b{position:absolute;left:50%;top:2.6cqw;width:27cqw;height:7.6cqw;transform:translateX(-50%);border-radius:5cqw;background:#0e0e10}
.phone .view{flex:1;min-height:0;overflow:hidden}

/* split: tela grande + página longa */
#desk{left:3.3vw;top:8.2vh;width:66.1vw;height:89.1vh}
#col{left:71.6vw;top:2.3vh;width:25.1vw;height:95.3vh;border-radius:calc(var(--r)*.85)}
/* devices: janela + celular */
#win{left:5vw;top:8vh;width:72vw;aspect-ratio:1440/934;max-height:84vh}
#ph{right:6vw;bottom:6vh;height:74vh}
/* wall: três colunas da página */
.strip{width:27vw}
#w1{left:6vw;top:-9vh;height:118vh}#w2{left:36.5vw;top:7vh;height:118vh}#w3{left:67vw;top:-3vh;height:118vh}
/* phones: trio */
body{--hc:min(84vh,66vw)}
#p1,#p2,#p3{top:50%;transform:translate(-50%,-50%)}
#p2{left:50%;height:var(--hc)}
#p1{left:calc(50vw - var(--hc)*.5);height:calc(var(--hc)*.86)}
#p3{left:calc(50vw + var(--hc)*.5);height:calc(var(--hc)*.86)}
/* focus: uma janela */
#one{left:50%;top:50%;width:min(84vw,128vh);aspect-ratio:1440/934;transform:translate(-50%,-50%)}
/* tilt: páginas inclinadas */
#tilt{position:absolute;left:50%;top:50%;width:150vw;height:170vh;display:flex;gap:3vw;justify-content:center;transform:translate(-50%,-50%) perspective(2600px) rotateX(30deg) rotateZ(-24deg)}
#tilt .strip{position:relative;flex:none;width:30vw;height:170vh}
#tilt .strip:nth-child(2){margin-top:12vh}#tilt .strip:nth-child(3){margin-top:-6vh}#tilt .strip:nth-child(4){margin-top:18vh}

/* telas em pé ou quadradas */
@media (max-aspect-ratio:6/5){
  #desk{left:6vw;top:4vh;width:88vw;height:56vh}
  #col{left:6vw;top:63vh;width:88vw;height:34vh}
  #win{left:5vw;top:6vh;width:90vw}
  #win{top:9vh}
  #ph{right:auto;left:50%;transform:translateX(-50%);bottom:4vh;height:58vh}
  .strip{width:28vw}#w1{left:5vw}#w2{left:36vw}#w3{left:67vw}
  #one{width:88vw}
}
</style></head><body>
${bg.photo ? `<img class="bgshot" src="desktop-hero.png" alt=""><div class="vignette"></div>` : ""}
${layoutHtml(layout, meta, frame, host, columnSections)}
</body></html>`;
}

async function render(htmlFile, outFile, w, h, scale, browser) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: outFile, type: "jpeg", quality: scale > 1 ? 90 : 92 });
  await ctx.close();
}

// ---------------------------------------------------------------- principal
const o = parseArgs(process.argv.slice(2));
const host = new URL(o.url).host;
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$|\.(localhost|test)(:\d+)?$/.test(host);
const label = o.label ?? (isLocal ? "" : host.replace(/^www\./, ""));
const outDir = resolve(o.out);
const capDir = join(outDir, ".capture", slug(host));
mkdirSync(capDir, { recursive: true });

let meta;
if (o.reuse && existsSync(join(capDir, "meta.json"))) {
  meta = JSON.parse(readFileSync(join(capDir, "meta.json"), "utf8"));
  console.log("capturas reaproveitadas:", capDir);
} else {
  console.log("capturando", o.url, "…");
  meta = await capture(o, capDir);
}

const name = o.name ?? slug(meta.palette.title.split(/[|·–—-]/)[0] || host);
console.log(`paleta: fundo ${meta.palette.bg} · texto ${meta.palette.text} · destaque ${meta.palette.accent}`);
console.log("seções (desktop):");
meta.sections.forEach((s, i) => console.log(`  [${i}] ${s.tag} y=${s.top} h=${s.height}`));

const columnSections = o.column ? o.column.map((i) => meta.sections[i]).filter(Boolean) : meta.sections.slice(1);
if (!columnSections.length) columnSections.push(...meta.sections);

const pairs =
  o.pairs ??
  (o.layouts || o.bgs ? (o.layouts ?? ["split"]).flatMap((l) => (o.bgs ?? ["auto"]).map((b) => [l, b])) : DEFAULT_SET);

const [w, h] = wh(o.size);
const browser = await launch();
const made = [];
for (const [layout, bgName] of pairs) {
  if (!LAYOUTS.includes(layout)) throw new Error(`layout desconhecido: ${layout} (use ${LAYOUTS.join(", ")})`);
  const bg = background(bgName, meta.palette);
  const html = join(capDir, `compose-${layout}-${slug(bgName)}.html`);
  writeFileSync(html, pageHtml({ layout, bg, meta, frame: o.frame, host: label, columnSections }));
  const base = join(outDir, `${name}-${layout}-${slug(bgName)}`);
  await render(html, `${base}.jpg`, w, h, 1, browser);
  await render(html, `${base}@2x.jpg`, w, h, 2, browser);
  made.push(`${base}.jpg`);
  console.log("ok", `${base}.jpg (+ @2x)`);
}
await browser.close();
console.log(`\n${made.length} arte(s) em ${outDir}`);
