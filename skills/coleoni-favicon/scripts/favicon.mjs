#!/usr/bin/env node
/**
 * Coleoni · a complete favicon set from a logo, plus a preview sheet.
 *
 *   node favicon.mjs <logo.svg|png|jpg> --out <folder> [options]
 *
 * Writes favicon.svg, favicon.ico (16/32/48), favicon-16/32.png,
 * apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png,
 * site.webmanifest, head.html (the tags to paste) and preview.html/.png.
 * Renders with the system Chrome or Edge (playwright-core).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `
node favicon.mjs <logo> --out <folder> [options]

  --bg "#0a0a0a" | transparent   tile color (default #ffffff; transparent keeps only the mark)
  --shape rounded|square|circle  tile shape for favicon.svg and the PNGs (default rounded)
  --radius 0.22                  corner radius as a fraction of the size (rounded only)
  --padding 0.14                 space around the mark, as a fraction of the size
  --crop x,y,w,h                 use only this part of an SVG logo (viewBox units)
  --dark-bg "#hex"               tile color when the browser is in dark mode (favicon.svg only)
  --name "App name"              name in site.webmanifest (default: the logo file name)
  --theme "#hex"                 theme_color in the manifest (default: the tile color)
`;

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const o = { logo: null, out: "favicon", bg: "#ffffff", shape: "rounded", radius: 0.22, padding: 0.14, crop: null, darkBg: null, name: null, theme: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? "";
    if (!a.startsWith("--")) {
      o.logo = a;
      continue;
    }
    switch (a) {
      case "--help":
        console.log(HELP);
        process.exit(0);
      case "--out": o.out = val(); break;
      case "--bg": o.bg = val(); break;
      case "--shape": o.shape = val(); break;
      case "--radius": o.radius = Number(val()); break;
      case "--padding": o.padding = Number(val()); break;
      case "--crop": o.crop = val().split(",").map(Number); break;
      case "--dark-bg": o.darkBg = val(); break;
      case "--name": o.name = val(); break;
      case "--theme": o.theme = val(); break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!o.logo) {
    console.log(HELP);
    process.exit(1);
  }
  const hex = /^#[0-9a-f]{3,8}$/i;
  if (o.bg !== "transparent" && !hex.test(o.bg)) fail(`--bg must be a hex color or "transparent", got ${o.bg}`);
  if (o.darkBg && !hex.test(o.darkBg)) fail(`--dark-bg must be a hex color, got ${o.darkBg}`);
  if (!["rounded", "square", "circle"].includes(o.shape)) fail(`--shape must be rounded, square or circle`);
  if (o.crop && (o.crop.length !== 4 || o.crop.some((n) => Number.isNaN(n)))) fail(`--crop needs four numbers: x,y,w,h`);
  return o;
}
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------- the mark
/** Returns { inner, viewBox, w, h } for an SVG, or { dataUri, w, h } for a raster. */
function loadMark(file, crop) {
  const ext = extname(file).toLowerCase();
  if (ext === ".svg") {
    const src = readFileSync(file, "utf8");
    const open = src.match(/<svg\b[^>]*>/i);
    if (!open) fail(`not an SVG: ${file}`);
    let vb = (open[0].match(/viewBox="([^"]+)"/i) || [])[1];
    if (!vb) {
      const w = (open[0].match(/\bwidth="([\d.]+)/) || [])[1];
      const h = (open[0].match(/\bheight="([\d.]+)/) || [])[1];
      if (!w || !h) fail(`the SVG needs a viewBox or width/height: ${file}`);
      vb = `0 0 ${w} ${h}`;
    }
    const inner = src.slice(src.indexOf(open[0]) + open[0].length, src.lastIndexOf("</svg>"));
    const [x, y, w, h] = crop ?? vb.split(/[\s,]+/).map(Number);
    return { inner, viewBox: `${x} ${y} ${w} ${h}`, w, h, svg: true };
  }
  if (crop) fail("--crop works only with SVG logos");
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { dataUri: `data:${type};base64,${readFileSync(file).toString("base64")}`, svg: false };
}

/** The tile as SVG markup at a given size: background shape plus the centered mark. */
function tileSvg(mark, o, size, { bg = o.bg, shape = o.shape, padding = o.padding, darkBg = null } = {}) {
  const pad = size * padding;
  const box = size - pad * 2;
  let bgEl = "";
  if (bg !== "transparent") {
    const r = shape === "circle" ? size / 2 : shape === "rounded" ? size * o.radius : 0;
    bgEl = `<rect class="tile" width="${size}" height="${size}" rx="${r}" fill="${bg}"/>`;
  }
  const style = darkBg ? `<style>@media (prefers-color-scheme: dark){.tile{fill:${darkBg}}}</style>` : "";
  let content;
  if (mark.svg) {
    content = `<svg x="${pad}" y="${pad}" width="${box}" height="${box}" viewBox="${mark.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${mark.inner}</svg>`;
  } else {
    content = `<image x="${pad}" y="${pad}" width="${box}" height="${box}" href="${mark.dataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${style}${bgEl}${content}</svg>`;
}

// ---------------------------------------------------------------- browser
async function launch() {
  const { chromium } = await import("playwright-core");
  const tries = [{ channel: "chrome" }, { channel: "msedge" }];
  if (process.env.CHROME_PATH) tries.unshift({ executablePath: process.env.CHROME_PATH });
  for (const t of tries) {
    try {
      return await chromium.launch(t);
    } catch {}
  }
  throw new Error("Chrome/Edge not found. Set CHROME_PATH to the Chrome executable.");
}

async function rasterize(browser, svg, size, outFile) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.waitForTimeout(30);
  const buf = await page.screenshot({ omitBackground: true, type: "png" });
  if (outFile) writeFileSync(outFile, buf);
  await ctx.close();
  return buf;
}

/** An .ico that holds PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const b = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, b);
    dir.writeUInt8(size >= 256 ? 0 : size, b + 1);
    dir.writeUInt8(0, b + 2);
    dir.writeUInt8(0, b + 3);
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

// ---------------------------------------------------------------- preview sheet
function previewHtml(o, name) {
  const img = (f, s, extra = "") => `<img src="${f}" width="${s}" height="${s}" alt=""${extra}>`;
  const tab = (theme) => `
  <div class="browser ${theme}">
    <div class="tabs">
      <div class="tab on">${img("favicon-32.png", 16)}<span>${esc(name)}</span><b>×</b></div>
      <div class="tab"><i></i><span>New tab</span></div>
    </div>
    <div class="bar"><span>${esc(name.toLowerCase().replace(/\s+/g, ""))}.com</span></div>
  </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} · favicon preview</title><style>
*{box-sizing:border-box;margin:0}
body{background:#ececee;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d20;padding:40px}
.sheet{width:100%;max-width:1520px;margin:0 auto;display:grid;grid-template-columns:1.25fr 1fr;gap:24px}
@media (max-width:1100px){.sheet{grid-template-columns:1fr}}
.card{background:#fff;border-radius:16px;padding:24px;display:grid;gap:16px;align-content:start}
.card.dark{background:#16171a;color:#f2f2f3}
h2{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
.browser{border-radius:12px;overflow:hidden;border:1px solid #dcdde1}
.browser.dark{border-color:#2c2d31}
.tabs{display:flex;gap:4px;padding:8px 8px 0;background:#dfe1e5}
.dark .tabs{background:#202124}
.tab{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:9px 9px 0 0;font-size:12.5px;color:#5f6368;min-width:190px}
.tab.on{background:#fff;color:#1d1d20}
.dark .tab.on{background:#35363a;color:#e8eaed}
.dark .tab{color:#9aa0a6}
.tab b{margin-left:auto;font-weight:400;color:#80868b}
.tab i{width:16px;height:16px;border-radius:50%;background:#bdc1c6}
.bar{background:#fff;padding:8px 12px;border-bottom:1px solid #dcdde1}
.dark .bar{background:#35363a;border-color:#2c2d31}
.bar span{display:block;background:#f1f3f4;border-radius:999px;padding:6px 14px;font-size:12.5px;color:#5f6368;width:60%}
.dark .bar span{background:#202124;color:#9aa0a6}
.phones{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.home{border-radius:22px;padding:22px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px 10px;justify-items:center;background:linear-gradient(160deg,#3b4a6b,#1b2236)}
.home.android{background:linear-gradient(160deg,#2d4b40,#13201b)}
.app{display:grid;gap:6px;justify-items:center;font-size:11px;color:#fff}
.app i{width:58px;height:58px;border-radius:14px;background:rgba(255,255,255,.18)}
.android .app i{border-radius:50%}
.ios{width:58px;height:58px;border-radius:14px;overflow:hidden;display:block}
.round{width:58px;height:58px;border-radius:50%;overflow:hidden;display:block}
.round img{width:58px;height:58px;display:block}
.sizes{display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap}
.size{display:grid;gap:8px;justify-items:center;font:11px ui-monospace,"SF Mono",Consolas,monospace;color:#8b8d94}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pix{image-rendering:pixelated}
</style></head><body><div class="sheet">
<div class="card"><h2>Browser tab · light</h2>${tab("light")}</div>
<div class="card dark"><h2>Browser tab · dark</h2>${tab("dark")}</div>
<div class="card"><h2>Home screen · iPhone and Android</h2><div class="phones">
<div class="home"><div class="app"><span class="ios">${img("apple-touch-icon.png", 58)}</span>${esc(name)}</div>${'<div class="app"><i></i>&nbsp;</div>'.repeat(7)}</div>
<div class="home android"><div class="app"><span class="round">${img("icon-maskable-512.png", 58)}</span>${esc(name)}</div>${'<div class="app"><i></i>&nbsp;</div>'.repeat(7)}</div>
</div></div>
<div class="card"><h2>Every size</h2>
<div class="pair"><div class="sizes">${[16, 32, 48].map((s) => `<div class="size">${img(`favicon-${s === 48 ? 32 : s}.png`, s, ' class="pix"')}${s}</div>`).join("")}<div class="size">${img("apple-touch-icon.png", 90)}180</div></div>
<div class="sizes" style="background:#16171a;border-radius:12px;padding:16px">${[16, 32].map((s) => `<div class="size">${img(`favicon-${s}.png`, s, ' class="pix"')}${s}</div>`).join("")}<div class="size">${img("icon-192.png", 64)}192</div><div class="size">${img("icon-512.png", 96)}512</div></div></div>
</div>
</div></body></html>`;
}

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const logo = resolve(o.logo);
if (!existsSync(logo)) fail(`not found: ${logo}`);
const mark = loadMark(logo, o.crop);
const out = resolve(o.out);
mkdirSync(out, { recursive: true });
const name = o.name || logo.split(/[\\/]/).pop().replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const solid = o.bg === "transparent" ? "#ffffff" : o.bg;
const theme = o.theme || solid;

// favicon.svg: vector, small, can follow dark mode
writeFileSync(join(out, "favicon.svg"), tileSvg(mark, o, 64, { darkBg: o.darkBg }));

const browser = await launch();
const pngs = {};
for (const s of [16, 32, 48]) {
  // small sizes: a bit less padding, so the mark keeps its weight
  pngs[s] = await rasterize(browser, tileSvg(mark, o, s, { padding: Math.max(0.06, o.padding - 0.04) }), s, s === 48 ? null : join(out, `favicon-${s}.png`));
}
writeFileSync(join(out, "favicon.ico"), ico([16, 32, 48].map((s) => ({ size: s, buf: pngs[s] }))));
// iOS fills transparency with black and rounds the corners itself: full-bleed square
await rasterize(browser, tileSvg(mark, o, 180, { bg: solid, shape: "square" }), 180, join(out, "apple-touch-icon.png"));
await rasterize(browser, tileSvg(mark, o, 192), 192, join(out, "icon-192.png"));
await rasterize(browser, tileSvg(mark, o, 512), 512, join(out, "icon-512.png"));
// maskable: full-bleed, the mark inside the central 80% safe zone
await rasterize(browser, tileSvg(mark, o, 512, { bg: solid, shape: "square", padding: Math.max(o.padding, 0.2) }), 512, join(out, "icon-maskable-512.png"));

writeFileSync(
  join(out, "site.webmanifest"),
  JSON.stringify(
    {
      name,
      short_name: name.length > 12 ? name.split(" ")[0] : name,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: theme,
      background_color: solid,
      display: "standalone",
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  join(out, "head.html"),
  [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${theme}">`,
    "",
  ].join("\n"),
);

writeFileSync(join(out, "preview.html"), previewHtml(o, name));
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(join(out, "preview.html")).href, { waitUntil: "load" });
const height = await page.evaluate(() => Math.ceil(document.querySelector(".sheet").getBoundingClientRect().bottom + 40));
await page.setViewportSize({ width: 1600, height });
await page.screenshot({ path: join(out, "preview.png") });
await browser.close();

for (const f of ["favicon.svg", "favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "site.webmanifest", "head.html", "preview.png"]) {
  console.log("ok", join(out, f));
}
