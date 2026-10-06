#!/usr/bin/env node
/**
 * Coleoni · share images (Open Graph) made from a site's real pages.
 *
 *   node og.mjs <url | file.html | folder ...> --out <folder> [options]
 *   node og.mjs --sitemap https://site.com/sitemap.xml --out <folder>
 *
 * For each page: reads its title, description, share tags, colors, fonts and
 * logo, renders a 1200x630 image in the page's own fonts, and checks the tags
 * the way link previews read them. Writes <page>.jpg, tags.html, report.md,
 * og.json and preview.html/.png (how the link looks in WhatsApp, X, LinkedIn,
 * Slack, Discord and iMessage). Renders with the system Chrome or Edge.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `
node og.mjs <url|file|folder ...> --out <folder> [options]

  --layout screen|title|hero   screen: text + the page in a browser frame (default)
                               title: logo and big type only
                               hero: the page's own first screen at 1200x630
  --sitemap <url>              take the pages from a sitemap.xml
  --limit 12                   pages taken from the sitemap
  --title "..."                text on the image (default: the page's h1)
  --subtitle "..."             second line (default: the meta description)
  --domain site.com            domain shown on the image and in the previews
  --logo <file>                logo to use instead of the one in the header
  --bg "#hex"                  background (default: the header's color)
  --accent "#hex"              accent (default: the color of the page's buttons)
  --base https://site.com/og/  public folder of the images, for the tags (default: <origin>/og/)
  --format jpg|png             image format (default jpg)
  --hide "sel,sel"             hide elements (cookie banners, chat widgets) before capture
  --wait 600                   extra wait after load, in ms
  --no-preview                 skip preview.html/.png
`;

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const o = { targets: [], out: "og", layout: "screen", sitemap: null, limit: 12, title: null, subtitle: null, domain: null, logo: null, bg: null, accent: null, base: null, format: "jpg", hide: [], wait: 600, preview: true };
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
      case "--layout": o.layout = val(); break;
      case "--sitemap": o.sitemap = val(); break;
      case "--limit": o.limit = Number(val()); break;
      case "--title": o.title = val(); break;
      case "--subtitle": o.subtitle = val(); break;
      case "--domain": o.domain = val(); break;
      case "--logo": o.logo = val(); break;
      case "--bg": o.bg = val(); break;
      case "--accent": o.accent = val(); break;
      case "--base": o.base = val(); break;
      case "--format": o.format = val(); break;
      case "--hide": o.hide = val().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--wait": o.wait = Number(val()); break;
      case "--no-preview": o.preview = false; break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!["screen", "title", "hero"].includes(o.layout)) fail(`--layout must be screen, title or hero`);
  if (!["jpg", "png"].includes(o.format)) fail(`--format must be jpg or png`);
  if (!o.targets.length && !o.sitemap) {
    console.log(HELP);
    process.exit(1);
  }
  return o;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A URL, a local HTML file or a folder with index.html */
function toUrl(t) {
  if (/^[a-z]+:\/\//i.test(t)) return t;
  const p = resolve(t);
  if (existsSync(p)) return pathToFileURL(statSync(p).isDirectory() ? join(p, "index.html") : p).href;
  if (/^localhost|^127\./.test(t)) return `http://${t}`;
  return `https://${t}`;
}

/** File name for a page: / -> home, /pt/about/ -> pt-about */
function slugOf(url) {
  const u = new URL(url);
  let p = u.protocol === "file:" ? basename(u.pathname) === "index.html" ? basename(u.pathname.replace(/\/index\.html$/, "")) : basename(u.pathname, extname(u.pathname)) : u.pathname;
  p = decodeURIComponent(p).replace(/index\.html?$/, "").replace(/\.html?$/, "");
  const s = p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return s || "home";
}

async function fromSitemap(url, limit) {
  const res = await fetch(url);
  if (!res.ok) fail(`sitemap: ${res.status} ${url}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  if (!locs.length) fail(`no <loc> in ${url}`);
  if (locs.length > limit) console.log(`sitemap has ${locs.length} pages, taking the first ${limit} (--limit)`);
  return locs.slice(0, limit);
}

// ---------------------------------------------------------------- colors
const rgb = (s) => {
  if (!s) return null;
  if (s.startsWith("#")) {
    const h = s.length === 4 ? [...s.slice(1)].map((c) => c + c).join("") : s.slice(1, 7);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const m = s.match(/[\d.]+/g);
  return m ? { r: +m[0], g: +m[1], b: +m[2] } : null;
};
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const css = (c, alpha = 1) => `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}${alpha < 1 ? ` / ${alpha}` : ""})`;
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

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

const FORCE_VISIBLE = `[data-aos],[data-sal],[data-scroll],.aos-init,.aos-animate,.reveal,.fade-in,.fade-up,.wow,[class*="animate__"]{opacity:1!important;transform:none!important;visibility:visible!important;animation:none!important;transition:none!important}`;

async function prepare(page, url, o) {
  const res = await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const hide = o.hide.length ? `${o.hide.join(",")}{display:none!important}` : "";
  await page.addStyleTag({ content: `html{scrollbar-width:none!important;scroll-behavior:auto!important}::-webkit-scrollbar{display:none!important}${hide}${FORCE_VISIBLE}` });
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
    for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 6000); y += 600) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo({ top: 0, behavior: "instant" });
    await document.fonts?.ready;
  });
  await page.waitForTimeout(o.wait);
  return res;
}

/** Everything a link preview reads, plus what the image needs */
function readPage() {
  const q = (s) => document.querySelector(s);
  const meta = (k) => (q(`meta[property="${k}"]`) || q(`meta[name="${k}"]`))?.getAttribute("content")?.trim() || null;
  const clear = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
  const h1el = [...document.querySelectorAll("h1")].find((h) => h.getBoundingClientRect().height > 0);
  const hcs = getComputedStyle(h1el ?? document.body);
  const bcs = getComputedStyle(document.body);
  let bodyBg = bcs.backgroundColor;
  if (clear(bodyBg)) bodyBg = getComputedStyle(document.documentElement).backgroundColor;
  if (clear(bodyBg)) bodyBg = "rgb(255, 255, 255)";
  const counts = new Map();
  for (const el of document.querySelectorAll("a, button, [class*=btn], [class*=button]")) {
    const c = getComputedStyle(el).backgroundColor;
    if (clear(c)) continue;
    const [r, g, b] = c.match(/[\d.]+/g).map(Number);
    const max = Math.max(r, g, b);
    if (max - Math.min(r, g, b) < 24) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  // no colored buttons: the most common saturated text color (links, labels, highlights)
  if (!counts.size) {
    for (const el of [...document.querySelectorAll("body *")].slice(0, 3000)) {
      if (!el.childNodes.length || !el.getBoundingClientRect().height) continue;
      const c = getComputedStyle(el).color;
      const [r, g, b] = c.match(/[\d.]+/g).map(Number);
      if (Math.max(r, g, b) - Math.min(r, g, b) < 60) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const icons = [...document.querySelectorAll("link[rel~=icon], link[rel=apple-touch-icon]")].map((l) => ({ rel: l.rel, href: l.href, sizes: l.getAttribute("sizes") }));
  const fs = parseFloat(hcs.fontSize) || 16;
  return {
    finalUrl: location.href,
    lang: document.documentElement.lang || null,
    title: document.title?.trim() || null,
    description: meta("description"),
    h1: h1el?.innerText.replace(/\s+/g, " ").trim() || null,
    canonical: q("link[rel=canonical]")?.href || null,
    og: Object.fromEntries([...document.querySelectorAll("meta[property^='og:']")].map((m) => [m.getAttribute("property"), m.content?.trim()])),
    twitter: Object.fromEntries([...document.querySelectorAll("meta[name^='twitter:'], meta[property^='twitter:']")].map((m) => [m.getAttribute("name") || m.getAttribute("property"), m.content?.trim()])),
    themeColor: meta("theme-color"),
    icons,
    bodyBg,
    text: bcs.color,
    h1Color: hcs.color,
    accent: [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    headFont: hcs.fontFamily,
    headWeight: hcs.fontWeight,
    headSpacing: (parseFloat(hcs.letterSpacing) || 0) / fs,
    bodyFont: bcs.fontFamily,
  };
}

/** The brand in the header (logo, or logo + name), as a transparent PNG */
async function captureBrand(page) {
  const handle = await page.evaluateHandle(() => {
    const scope = document.querySelector("header, [role=banner], nav, [class*=header], [class*=navbar]");
    if (!scope) return null;
    const base = new URL("./", location.href).pathname;
    const links = [...scope.querySelectorAll("a[href]")];
    const home = (a) => {
      const h = a.getAttribute("href");
      if (h === "/" || h === "./" || h === "index.html") return true;
      try {
        const u = new URL(a.href);
        return u.origin === location.origin && !u.hash && (u.pathname === "/" || u.pathname === base || /^\/[a-z]{2}(-[a-z]{2})?\/$/i.test(u.pathname));
      } catch {
        return false;
      }
    };
    const fits = (el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 12 && r.height >= 10 && r.width <= 520 && r.height <= 140 && r.left < innerWidth * 0.5;
    };
    const media = (a) => a.querySelector("svg, img, picture");
    const el =
      links.find((a) => home(a) && media(a) && fits(a)) ??
      links.find((a) => media(a) && fits(a)) ??
      links.find((a) => home(a) && a.innerText.trim().length > 1 && a.innerText.trim().length < 40 && fits(a)) ??
      [...scope.querySelectorAll("svg, img")].find(fits);
    return el ?? null;
  });
  const el = handle.asElement();
  if (!el) return null;
  const info = await el.evaluate((n) => {
    const clear = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
    let bg = null;
    for (let p = n; p && !bg; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (!clear(c)) bg = c;
    }
    for (let p = n; p; p = p.parentElement) {
      p.style.setProperty("background", "transparent", "important");
      p.style.setProperty("box-shadow", "none", "important");
      p.style.setProperty("backdrop-filter", "none", "important");
    }
    document.documentElement.style.setProperty("background", "transparent", "important");
    const r = n.getBoundingClientRect();
    return { bg, w: r.width, h: r.height };
  });
  const png = await el.screenshot({ omitBackground: true, type: "png" });
  return { ...info, src: `data:image/png;base64,${png.toString("base64")}` };
}

function logoFromFile(file) {
  const p = resolve(file);
  if (!existsSync(p)) fail(`logo not found: ${file}`);
  const type = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(p).toLowerCase()];
  if (!type) fail(`logo must be svg, png, jpg or webp`);
  return { src: `data:${type};base64,${readFileSync(p).toString("base64")}`, w: 200, h: 40 };
}

// ---------------------------------------------------------------- the image
function stripSite(title) {
  if (!title) return title;
  const parts = title.split(/\s+[|·•–—-]\s+/);
  return parts.length > 1 ? parts.slice(0, -1).join(" · ") : title;
}

function design(info, brand, o, url) {
  const host = (u) => {
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      return h && h !== "localhost" && !/^127\./.test(h) ? h : null;
    } catch {
      return null;
    }
  };
  const bg = rgb(o.bg) ?? rgb(brand?.bg) ?? rgb(info.bodyBg) ?? WHITE;
  let text = rgb(info.h1Color) ?? BLACK;
  if (contrast(text, bg) < 3) text = rgb(info.text) ?? BLACK;
  if (contrast(text, bg) < 3) text = lum(bg) > 0.4 ? BLACK : WHITE;
  let accent = rgb(o.accent) ?? rgb(info.accent) ?? rgb(info.themeColor) ?? text;
  if (contrast(accent, bg) < 1.4) accent = text;
  const title = o.title ?? (info.h1 && info.h1.length >= 6 && info.h1.length <= 120 ? info.h1 : null) ?? info.og["og:title"] ?? stripSite(info.title) ?? host(url) ?? "Untitled";
  const subtitle = o.subtitle ?? info.description ?? info.og["og:description"] ?? "";
  const domain = o.domain ?? host(info.canonical) ?? host(info.og["og:url"]) ?? host(info.finalUrl) ?? info.og["og:site_name"] ?? "";
  return { bg, text, accent, muted: mix(text, bg, 0.4), line: css(text, 0.12), dark: lum(bg) < 0.3, title, subtitle, domain };
}

function ogHtml(layout, d, info, brand, heroSrc) {
  const logo = brand
    ? `<img class="logo" src="${brand.src}" style="height:${Math.round(Math.max(26, Math.min(brand.h * 1.35, 54)))}px" alt="">`
    : d.domain
      ? `<span class="wordmark">${esc(d.domain)}</span>`
      : "";
  const base = `
  :host{all:initial}
  *{box-sizing:border-box;margin:0}
  .og{position:fixed;left:0;top:0;width:1200px;height:630px;overflow:hidden;background:${css(d.bg)};color:${css(d.text)};font-family:${info.bodyFont};-webkit-font-smoothing:antialiased}
  .glow{position:absolute;inset:0;background:radial-gradient(900px 520px at 100% 0%,${css(d.accent, d.dark ? 0.16 : 0.12)},transparent 70%)}
  .logo{display:block;width:auto;max-width:420px;object-fit:contain;object-position:left center}
  .wordmark{font:600 24px/1 ${info.headFont};letter-spacing:-.01em}
  .t{font-family:${info.headFont};font-weight:${info.headWeight};letter-spacing:${Math.max(-0.05, Math.min(info.headSpacing, 0.02)).toFixed(3)}em;line-height:1.06;overflow:hidden;text-wrap:balance}
  .d{color:${css(d.muted)};line-height:1.42;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
  .dom{display:flex;align-items:center;gap:12px;font-size:20px;color:${css(d.muted)};font-weight:500}
  .dom i{width:11px;height:11px;border-radius:50%;background:${css(d.accent)}}`;
  if (layout === "title") {
    return {
      css: `${base}
  .in{position:absolute;inset:68px 80px 60px;display:flex;flex-direction:column}
  .mid{margin:auto 0;display:grid;gap:26px;max-width:1000px}
  .t{font-size:84px;max-height:282px}
  .d{font-size:26px;-webkit-line-clamp:2;max-width:880px}
  .foot{display:flex;justify-content:space-between;align-items:center}
  .bar{width:140px;height:6px;border-radius:3px;background:${css(d.accent)}}`,
      html: `<div class="og"><div class="glow"></div><div class="in">${logo}<div class="mid"><div class="t" data-fit="84,46">${esc(d.title)}</div>${d.subtitle ? `<div class="d">${esc(d.subtitle)}</div>` : ""}</div><div class="foot"><div class="dom">${esc(d.domain)}</div><div class="bar"></div></div></div></div>`,
    };
  }
  // screen
  const chrome = mix(d.bg, d.text, d.dark ? 0.1 : 0.06);
  return {
    css: `${base}
  .in{position:absolute;left:72px;top:64px;bottom:58px;width:468px;display:flex;flex-direction:column}
  .mid{margin:auto 0;display:grid;gap:20px}
  .t{font-size:62px;max-height:330px}
  .d{font-size:21px;-webkit-line-clamp:3}
  .shot{position:absolute;left:600px;top:104px;width:800px;height:560px;border-radius:14px 0 0 0;overflow:hidden;background:${css(rgb(info.bodyBg) ?? WHITE)};border:1px solid ${d.line};box-shadow:0 40px 90px -30px rgb(0 0 0 / ${d.dark ? 0.7 : 0.35}),0 0 0 8px ${css(d.text, 0.04)}}
  .shot .bar{height:34px;background:${css(chrome)};display:flex;align-items:center;gap:7px;padding:0 14px;border-bottom:1px solid ${d.line}}
  .shot .bar span{width:10px;height:10px;border-radius:50%;background:${css(d.text, 0.2)}}
  .shot img{display:block;width:800px;height:auto}`,
    html: `<div class="og"><div class="glow"></div><div class="in">${logo}<div class="mid"><div class="t" data-fit="62,34">${esc(d.title)}</div>${d.subtitle ? `<div class="d">${esc(d.subtitle)}</div>` : ""}</div><div class="dom"><i></i>${esc(d.domain)}</div></div><div class="shot"><div class="bar"><span></span><span></span><span></span></div><img src="${heroSrc}" alt=""></div></div>`,
  };
}

/** Puts the composition over the page (so the page's own fonts apply) and shrinks the title to fit */
async function compose(page, html, cssText) {
  await page.evaluate(
    async ({ html, cssText }) => {
      scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("__coleoni_og")?.remove();
      const host = document.createElement("div");
      host.id = "__coleoni_og";
      host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:block";
      document.documentElement.appendChild(host);
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${cssText}</style>${html}`;
      await Promise.all([...root.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
      await document.fonts?.ready;
      for (const t of root.querySelectorAll("[data-fit]")) {
        const [max, min] = t.dataset.fit.split(",").map(Number);
        const limit = parseFloat(getComputedStyle(t).maxHeight);
        t.style.maxHeight = "none";
        let s = max;
        t.style.fontSize = `${s}px`;
        while (s > min && (t.scrollHeight > limit + 1 || t.scrollWidth > t.clientWidth + 1)) {
          s -= 2;
          t.style.fontSize = `${s}px`;
        }
        t.style.maxHeight = `${limit}px`;
      }
    },
    { html, cssText },
  );
}

// ---------------------------------------------------------------- checks
async function audit(ctx, page, info, response, requested) {
  const c = [];
  const add = (level, label, detail) => c.push({ level, label, detail });
  const og = info.og;
  const tw = info.twitter;
  if (response && response.status() >= 400) add("miss", "Page", `responds ${response.status()}; previews will be empty`);
  if (info.finalUrl.replace(/\/$/, "") !== requested.replace(/\/$/, "")) add("warn", "Redirect", `goes to ${info.finalUrl}; previews follow it, so tag the final page`);
  if (!info.title) add("miss", "<title>", "missing");
  else if (info.title.length > 60) add("warn", "<title>", `${info.title.length} characters; cut after about 60`);
  else add("ok", "<title>", `${info.title.length} characters`);
  if (!info.description) add("miss", "meta description", "missing; most previews show it under the title");
  else if (info.description.length < 50 || info.description.length > 160) add("warn", "meta description", `${info.description.length} characters; aim for 50 to 160`);
  else add("ok", "meta description", `${info.description.length} characters`);
  add(og["og:title"] ? "ok" : "miss", "og:title", og["og:title"] ? `“${og["og:title"]}”` : "missing; some apps fall back to <title>, others show nothing");
  add(og["og:description"] ? "ok" : "miss", "og:description", og["og:description"] ? `${og["og:description"].length} characters` : "missing");
  const img = og["og:image"] || og["og:image:url"] || og["og:image:secure_url"];
  let current = null;
  if (!img) add("miss", "og:image", "missing; the link shares without a picture");
  else {
    const abs = /^https?:\/\//i.test(img);
    if (!abs) add("warn", "og:image", `relative URL (${img}); Facebook, LinkedIn and WhatsApp need an absolute https URL`);
    const full = new URL(img, info.finalUrl).href;
    try {
      const r = await ctx.request.get(full, { timeout: 20000 });
      const type = r.headers()["content-type"] ?? "";
      const body = r.ok() ? await r.body() : null;
      if (!r.ok()) add("miss", "og:image", `responds ${r.status()} at ${full}`);
      else if (!type.startsWith("image/")) add("miss", "og:image", `is ${type || "not an image"}`);
      else {
        const size = await page.evaluate(async (src) => {
          const i = new Image();
          i.src = src;
          await i.decode().catch(() => {});
          return { w: i.naturalWidth, h: i.naturalHeight };
        }, `data:${type};base64,${body.toString("base64")}`);
        const kb = Math.round(body.length / 1024);
        const ratio = size.w / size.h;
        current = { url: full, type, kb, ...size, src: `data:${type};base64,${body.toString("base64")}` };
        if (size.w < 600) add("warn", "og:image", `${size.w}x${size.h}; under 600px wide shows as a small thumbnail`);
        else if (Math.abs(ratio - 1.91) > 0.12) add("warn", "og:image", `${size.w}x${size.h}; not 1.91:1, so X and LinkedIn crop it`);
        else if (kb > 600) add("warn", "og:image", `${size.w}x${size.h}, ${kb} KB; WhatsApp may skip images this heavy`);
        else if (abs) add("ok", "og:image", `${size.w}x${size.h}, ${kb} KB`);
        if (full.startsWith("http:")) add("warn", "og:image", "served over http; use https");
      }
    } catch (e) {
      add("miss", "og:image", `could not load ${full}`);
    }
    if (!og["og:image:alt"]) add("warn", "og:image:alt", "missing; screen readers announce the image as unlabeled");
  }
  add(og["og:url"] || info.canonical ? "ok" : "warn", "og:url / canonical", og["og:url"] || info.canonical || "missing; shares of the same page with different query strings count apart");
  add(og["og:type"] ? "ok" : "warn", "og:type", og["og:type"] || "missing; use website");
  const card = tw["twitter:card"];
  if (!card) add("warn", "twitter:card", "missing; X shows a small square card instead of the large image");
  else if (card !== "summary_large_image" && img) add("warn", "twitter:card", `${card}; summary_large_image shows the image at full width`);
  else add("ok", "twitter:card", card);
  return { checks: c, current };
}

// ---------------------------------------------------------------- tags
function tagsFor(p, o) {
  const origin = p.url.startsWith("http") ? new URL(p.url).origin : "";
  const base = o.base ? o.base.replace(/\/?$/, "/") : `${origin}/og/`;
  const pageUrl = p.info.canonical || p.info.og["og:url"] || (p.url.startsWith("http") ? p.info.finalUrl : null);
  const title = p.info.og["og:title"] || p.info.title || p.d.title;
  const desc = p.info.og["og:description"] || p.info.description || p.d.subtitle;
  const lines = [
    `<meta property="og:type" content="${esc(p.info.og["og:type"] || "website")}">`,
    pageUrl ? `<meta property="og:url" content="${esc(pageUrl)}">` : null,
    `<meta property="og:title" content="${esc(title)}">`,
    desc ? `<meta property="og:description" content="${esc(desc)}">` : null,
    p.info.og["og:site_name"] || p.d.domain ? `<meta property="og:site_name" content="${esc(p.info.og["og:site_name"] || p.d.domain)}">` : null,
    p.info.lang ? `<meta property="og:locale" content="${esc(p.info.lang.replace("-", "_"))}">` : null,
    `<meta property="og:image" content="${esc(base + p.file)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(p.d.title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean);
  return { title, desc, pageUrl, imageUrl: base + p.file, lines };
}

// ---------------------------------------------------------------- preview
function previewHtml(pages, o) {
  const p = pages[0];
  const t = p.tags;
  const dom = p.d.domain || "example.com";
  const path = p.url.startsWith("http") ? new URL(p.info.finalUrl).pathname : "/";
  const link = `https://${dom}${path === "/" ? "" : path}`;
  const img = `./${p.file}`;
  const clamp = (n) => `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${n};overflow:hidden`;
  const wa = (withImg, title, desc) => `
    <div class="wa"><div class="bubble">
      ${title ? `<div class="wa-card">${withImg ? `<img src="${withImg}" alt="">` : ""}<div class="wa-tx"><b style="${clamp(2)}">${esc(title)}</b>${desc ? `<span style="${clamp(2)}">${esc(desc)}</span>` : ""}<small>${esc(dom)}</small></div></div>` : ""}
      <div class="wa-link">${esc(link)}</div><div class="wa-time">10:42</div>
    </div></div>`;
  const now = p.current ? p.current.src : null;
  const nowTitle = p.info.og["og:title"] || p.info.title;
  const nowDesc = p.info.og["og:description"] || p.info.description;
  const checks = p.checks.map((c) => `<li class="${c.level}"><i></i><b>${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join("");
  const grid = pages.length > 1 ? `<h2>All pages</h2><div class="all">${pages.map((q) => `<figure><img src="./${q.file}" alt=""><figcaption>${esc(q.file)}</figcaption></figure>`).join("")}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#16171a;color:#e8e8ea;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.sheet{width:100%;max-width:1520px;margin:0 auto;padding:44px 40px 48px;display:grid;gap:30px}
h1{font-size:15px;font-weight:600;color:#9a9ca3;letter-spacing:.04em;text-transform:uppercase}
h1 em{font-style:normal;color:#f2f2f3;text-transform:none;letter-spacing:0}
h2{font-size:13px;font-weight:600;color:#8b8d94;letter-spacing:.06em;text-transform:uppercase;margin-bottom:-14px}
.top{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:30px;align-items:start}
.big img{width:100%;display:block;border-radius:12px;border:1px solid #2a2b2f}
.big p{margin-top:10px;font:12.5px ui-monospace,"SF Mono",Consolas,monospace;color:#8b8d94}
.pair{display:grid;gap:18px}
.lab{font:600 11.5px system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8b8d94;margin-bottom:8px}
.lab.after{color:#aefa0e}
.cell{border-radius:14px;overflow:hidden;padding:18px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;align-items:start}
.wa{background:#0b141a;border-radius:14px;padding:16px}
.bubble{background:#005c4b;border-radius:9px;padding:4px 4px 6px;max-width:400px;margin-left:auto;color:#e9edef;font-size:14px}
.wa-card{background:#025144;border-radius:6px;overflow:hidden}
.wa-card img{display:block;width:100%;aspect-ratio:1.91;object-fit:cover}
.wa-tx{padding:8px 10px 9px;display:grid;gap:2px}
.wa-tx b{font-weight:600}
.wa-tx span{color:#b4c2c9;font-size:13px}
.wa-tx small{color:#8fa3ac;font-size:12.5px}
.wa-link{padding:6px 8px 0;color:#53bdeb;word-break:break-all}
.wa-time{text-align:right;font-size:11px;color:#9fb3ad;padding:0 6px}
.x{background:#fff;color:#0f1419}
.x .who{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.x .av{width:36px;height:36px;border-radius:50%;background:#cfd9de}
.x .who b{font-size:15px}.x .who span{color:#536471}
.x .card{border:1px solid #cfd9de;border-radius:16px;overflow:hidden;position:relative}
.x .card img{display:block;width:100%;aspect-ratio:1.91;object-fit:cover}
.x .pill{position:absolute;left:12px;bottom:12px;max-width:calc(100% - 24px);background:rgb(0 0 0 / .77);color:#fff;font-size:13px;padding:2px 6px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x .from{color:#536471;font-size:13px;margin-top:5px}
.li{background:#f4f2ee;color:#000000e6}
.li .post{background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0dfdc}
.li .post p{padding:12px 14px;font-size:14px}
.li img{display:block;width:100%;aspect-ratio:1.91;object-fit:cover}
.li .meta{padding:10px 14px 12px;border-top:1px solid #e0dfdc}
.li .meta b{font-size:14px;font-weight:600;${clamp(2)}}
.li .meta span{font-size:12px;color:#00000099}
.sl{background:#fff;color:#1d1c1d;font-size:14.5px}
.sl .att{border-left:4px solid #dddddd;padding-left:12px;display:grid;gap:3px}
.sl .site{font-weight:700;display:flex;gap:6px;align-items:center}
.sl .ttl{color:#1264a3;font-weight:700}
.sl .att span{${clamp(3)}}
.sl img{width:100%;max-width:360px;border-radius:8px;border:1px solid #e3e3e3;margin-top:6px;aspect-ratio:1.91;object-fit:cover}
.dc{background:#313338;color:#dbdee1}
.dc .emb{background:#2b2d31;border-left:4px solid ${css(p.d.accent)};border-radius:4px;padding:12px 14px 14px;display:grid;gap:6px}
.dc small{color:#b5bac1;font-size:12px}
.dc .ttl{color:#00a8fc;font-weight:600;font-size:15.5px}
.dc span{font-size:14px;${clamp(3)}}
.dc img{width:100%;border-radius:4px;margin-top:6px;aspect-ratio:1.91;object-fit:cover}
.im{background:#fff}
.im .bub{max-width:330px;margin-left:auto;border-radius:18px;overflow:hidden;background:#e9e9eb}
.im img{display:block;width:100%;aspect-ratio:1.91;object-fit:cover}
.im .bub div{padding:9px 13px 10px;display:grid;gap:1px}
.im b{font-size:13px;color:#000;${clamp(2)}}
.im span{font-size:13px;color:#8e8e93}
ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 28px}
li{display:grid;grid-template-columns:14px 170px minmax(0,1fr);gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid #26272b}
li i{width:9px;height:9px;border-radius:50%;background:#aefa0e;transform:translateY(-1px)}
li.warn i{background:#f5b84a}li.miss i{background:#ff6b5e}
li b{font:500 13px ui-monospace,"SF Mono",Consolas,monospace;color:#f2f2f3}
li span{color:#9a9ca3}
.all{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.all img{width:100%;display:block;border-radius:8px;border:1px solid #2a2b2f}
.all figcaption{font:12px ui-monospace,Consolas,monospace;color:#8b8d94;margin-top:6px}
</style></head><body><div class="sheet">
<h1>Share preview · <em>${esc(link)}</em></h1>
<div class="top">
  <div class="big"><img src="${img}" alt=""><p>${esc(p.file)} · 1200 × 630 · ${p.kb} KB · ${esc(o.layout)}</p></div>
  <div class="pair">
    <div><div class="lab">Today</div>${wa(now, nowTitle && (now || p.info.og["og:title"] || p.info.description) ? nowTitle : null, nowDesc)}</div>
    <div><div class="lab after">With the new tags</div>${wa(img, t.title, t.desc)}</div>
  </div>
</div>
<h2>Where it shows</h2>
<div class="grid">
  <div><div class="lab">X</div><div class="cell x"><div class="who"><div class="av"></div><div><b>You</b> <span>@you · 1m</span></div></div><div class="card"><img src="${img}" alt=""><div class="pill">${esc(t.title)}</div></div><div class="from">From ${esc(dom)}</div></div></div>
  <div><div class="lab">LinkedIn</div><div class="cell li"><div class="post"><p>New on the site:</p><img src="${img}" alt=""><div class="meta"><b>${esc(t.title)}</b><span>${esc(dom)}</span></div></div></div></div>
  <div><div class="lab">iMessage</div><div class="cell im"><div class="bub"><img src="${img}" alt=""><div><b>${esc(t.title)}</b><span>${esc(dom)}</span></div></div></div></div>
  <div><div class="lab">Slack</div><div class="cell sl"><div class="att"><div class="site">${esc(p.info.og["og:site_name"] || dom)}</div><div class="ttl">${esc(t.title)}</div>${t.desc ? `<span>${esc(t.desc)}</span>` : ""}<img src="${img}" alt=""></div></div></div>
  <div><div class="lab">Discord</div><div class="cell dc"><div class="emb"><small>${esc(p.info.og["og:site_name"] || dom)}</small><div class="ttl">${esc(t.title)}</div>${t.desc ? `<span>${esc(t.desc)}</span>` : ""}<img src="${img}" alt=""></div></div></div>
  <div><div class="lab">WhatsApp</div>${wa(img, t.title, t.desc)}</div>
</div>
<h2>Checks today</h2>
<ul>${checks}</ul>
${grid}
</div></body></html>`;
}

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const out = resolve(o.out);
mkdirSync(out, { recursive: true });
const urls = [...o.targets.map(toUrl), ...(o.sitemap ? await fromSitemap(o.sitemap, o.limit) : [])];
if (urls.length > 1 && (o.title || o.subtitle)) console.log("note: --title/--subtitle apply to every page");

const browser = await launch();
// Link previews are fetched by bots with no locale and US time, so the pages are read the same way
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, bypassCSP: true, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
const pages = [];
const used = new Set();
for (const url of urls) {
  const page = await ctx.newPage();
  try {
    const response = await prepare(page, url, o);
    const info = await page.evaluate(readPage);
    const { checks, current } = await audit(ctx, page, info, response, url);
    let slug = slugOf(info.finalUrl);
    while (used.has(slug)) slug += "-2";
    used.add(slug);
    const file = `${slug}.${o.format}`;
    const shotOpts = { type: o.format === "jpg" ? "jpeg" : "png", ...(o.format === "jpg" ? { quality: 88 } : {}) };
    let d;
    if (o.layout === "hero") {
      d = design(info, null, o, url);
      await page.setViewportSize({ width: 1200, height: 630 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, file), scale: "css", clip: { x: 0, y: 0, width: 1200, height: 630 }, ...shotOpts });
    } else {
      const hero = await page.screenshot({ type: "jpeg", quality: 90 });
      const brand = o.logo ? logoFromFile(o.logo) : await captureBrand(page);
      d = design(info, brand, o, url);
      await page.setViewportSize({ width: 1200, height: 630 });
      const { html, css: cssText } = ogHtml(o.layout, d, info, brand, `data:image/jpeg;base64,${hero.toString("base64")}`);
      await compose(page, html, cssText);
      await page.screenshot({ path: join(out, file), scale: "css", clip: { x: 0, y: 0, width: 1200, height: 630 }, ...shotOpts });
    }
    const kb = Math.round(statSync(join(out, file)).size / 1024);
    const p = { url, slug, file, kb, info, d, checks, current };
    p.tags = tagsFor(p, o);
    pages.push(p);
    const miss = checks.filter((c) => c.level === "miss").length;
    const warn = checks.filter((c) => c.level === "warn").length;
    console.log(`ok ${file}  ${kb} KB  ·  ${miss} missing, ${warn} to fix  ·  ${info.finalUrl}`);
  } catch (e) {
    console.error(`failed ${url}: ${e.message.split("\n")[0]}`);
  }
  await page.close();
}

if (!pages.length) fail("no page could be read");

// tags.html, og.json, report.md
writeFileSync(join(out, "tags.html"), pages.map((p) => `<!-- ${p.info.finalUrl} -->\n${p.tags.lines.join("\n")}\n`).join("\n"));
writeFileSync(join(out, "og.json"), JSON.stringify(pages.map((p) => ({ url: p.info.finalUrl, image: p.file, kb: p.kb, imageUrl: p.tags.imageUrl, title: p.d.title, subtitle: p.d.subtitle, domain: p.d.domain, colors: { bg: hex(p.d.bg), text: hex(p.d.text), accent: hex(p.d.accent) }, checks: p.checks, tags: p.tags.lines })), null, 2));
const icon = { ok: "ok", warn: "fix", miss: "missing" };
const report = [
  `# Share check`,
  ``,
  `${pages.length} page${pages.length > 1 ? "s" : ""} read as a link preview bot reads them (no cookies, en-US, UTC).`,
  ``,
  ...pages.flatMap((p) => [
    `## ${p.info.finalUrl}`,
    ``,
    `New image: \`${p.file}\` (1200x630, ${p.kb} KB)`,
    ``,
    `| | Tag | Today |`,
    `| --- | --- | --- |`,
    ...p.checks.map((c) => `| ${icon[c.level]} | \`${c.label.replace(/\|/g, "\\|")}\` | ${c.detail.replace(/\|/g, "\\|")} |`),
    ``,
  ]),
].join("\n");
writeFileSync(join(out, "report.md"), report);

if (o.preview) {
  writeFileSync(join(out, "preview.html"), previewHtml(pages, o));
  const pv = await browser.newPage({ viewport: { width: 1520, height: 900 } });
  await pv.goto(pathToFileURL(join(out, "preview.html")).href, { waitUntil: "load" });
  await pv.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const h = await pv.evaluate(() => Math.ceil(document.querySelector(".sheet").getBoundingClientRect().height));
  await pv.setViewportSize({ width: 1520, height: h });
  await pv.screenshot({ path: join(out, "preview.png") });
  await pv.close();
}
await browser.close();
console.log(`ok ${join(out, o.preview ? "preview.png" : "tags.html")}`);
