#!/usr/bin/env node
/**
 * Coleoni · color: what the page uses, what reads, and a palette that holds.
 *
 *   node color.mjs <url | folder | file.html> --out <folder> [--brand "#C8643B,#2F4A3A"] [--lang pt]
 *
 * Collects every color on screen (text, backgrounds, borders, icons) with how
 * often it is used, groups the ones that are almost the same (in OKLab), checks
 * the contrast of every text on its real background, counts how many colors
 * in the CSS are hardcoded instead of tokens, and looks for a dark mode. Then
 * proposes a palette: an OKLCH scale for each brand color, tinted neutrals and
 * semantic tokens for light and dark, every text pair checked for contrast.
 * Writes report.html, report.png, report.json, report.md and palette.css.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { esc, launch, load, open, parseArgs, report, shootFindings, writeReport, mdFindings } from "./lib.mjs";

const HELP = `
node color.mjs <url|folder|file> --out <folder> [options]

  --brand "#hex,#hex"  brand colors for the palette (default: the most used colorful ones)
  --select "main"      only this part of the page
  --lang en|pt         language of the report
`;
const o = parseArgs(process.argv.slice(2), { out: "color-report", brand: "", select: "body", width: 1280, lang: "en", wait: 400 }, HELP);
if (!o._.length) {
  console.log(HELP);
  process.exit(1);
}
const pt = o.lang === "pt";
const out = resolve(o.out);

// ---------------------------------------------------------------- color math (sRGB <-> OKLab/OKLCH)
const parse = (s) => {
  if (s.startsWith("#")) {
    const h = s.length === 4 ? [...s.slice(1)].map((c) => c + c).join("") : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const m = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return m.slice(0, 3);
};
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const unlin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function toLab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const toLch = (rgb) => {
  const [L, a, b] = toLab(rgb);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};
const inGamut = (lr) => lr.every((v) => v >= -0.0005 && v <= 1.0005);
function fromLch(L, C, H) {
  // reduce chroma until the color fits in sRGB
  for (let c = C; c >= 0; c -= 0.002) {
    const lr = fromLab([L, c * Math.cos((H * Math.PI) / 180), c * Math.sin((H * Math.PI) / 180)]);
    if (inGamut(lr)) return lr.map(unlin);
  }
  return fromLab([L, 0, 0]).map(unlin);
}
const dE = (a, b) => {
  const x = toLab(a);
  const y = toLab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---------------------------------------------------------------- in the page
function analyze(sel) {
  const root = document.querySelector(sel) ?? document.body;
  let n = 0;
  const idOf = (el) => (el.dataset.cx ||= `c${++n}`);
  const clear = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  const solid = (c) => c.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, "rgb($1,$2,$3)");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const uses = new Map();
  const add = (c, role, el) => {
    if (clear(c)) return;
    const k = solid(c);
    if (!uses.has(k)) uses.set(k, { roles: {}, ids: [] });
    const u = uses.get(k);
    u.roles[role] = (u.roles[role] ?? 0) + 1;
    if (u.ids.length < 6) u.ids.push(idOf(el));
  };
  const bgOf = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (!clear(c)) return solid(c);
    }
    return "rgb(255, 255, 255)";
  };
  const pairs = new Map();
  for (const el of [root, ...root.querySelectorAll("*")]) {
    if (/^(SCRIPT|STYLE|OPTION)$/.test(el.tagName) || !vis(el)) continue;
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
    if (el.closest("svg")) {
      if (el.tagName !== "svg") {
        if (cs.fill && cs.fill !== "none") add(cs.fill, "icon", el);
        if (cs.stroke && cs.stroke !== "none") add(cs.stroke, "icon", el);
      }
      continue;
    }
    if (ownText) {
      add(cs.color, "text", el);
      const k = `${solid(cs.color)}|${bgOf(el)}`;
      const fs = parseFloat(cs.fontSize);
      const large = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700);
      if (!pairs.has(k)) pairs.set(k, { fg: solid(cs.color), bg: bgOf(el), large, ids: [], sample: el.innerText.trim().slice(0, 40), fs });
      const p = pairs.get(k);
      p.large = p.large && large;
      if (p.ids.length < 4) p.ids.push(idOf(el));
    }
    add(cs.backgroundColor, "background", el);
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") add(cs.borderTopColor, "border", el);
  }
  // the stylesheets: colors written as literals vs tokens, and a dark mode
  let literal = 0, token = 0, dark = false;
  const tokens = {};
  const COLOR_PROPS = /^(color|background|background-color|border|border-color|border-(top|right|bottom|left)(-color)?|outline-color|fill|stroke|box-shadow|text-decoration-color|caret-color)$/;
  const walk = (rules) => {
    for (const r of rules) {
      if (r.media && /prefers-color-scheme:\s*dark/.test(r.media.mediaText)) dark = true;
      if (r.cssRules) walk(r.cssRules);
      if (!r.style) continue;
      for (const p of r.style) {
        const v = r.style.getPropertyValue(p).trim();
        if (p.startsWith("--") && /^(#|rgb|hsl|oklch|lab|color\()/i.test(v)) tokens[p] = v;
        if (!COLOR_PROPS.test(p)) continue;
        if (/var\(--/.test(v)) token++;
        else if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(v)) literal++;
      }
    }
  };
  for (const s of document.styleSheets) {
    try {
      walk(s.cssRules);
    } catch {}
  }
  if (document.querySelector('meta[name="color-scheme"][content*="dark"]')) dark = true;
  return { uses: [...uses].map(([c, u]) => ({ c, ...u, n: Object.values(u.roles).reduce((a, b) => a + b, 0) })), pairs: [...pairs.values()], literal, token, dark, tokens, pageBg: bgOf(document.body) };
}

const target = await open(o._[0]);
const browser = await launch();
const { page, ctx } = await load(browser, target.url, { width: o.width, wait: o.wait });
const d = await page.evaluate(analyze, o.select);

const colors = d.uses.map((u) => ({ ...u, rgb: parse(u.c), hex: hex(parse(u.c)), lch: toLch(parse(u.c)) })).sort((a, b) => b.n - a.n);

// near-duplicates: same color for the eye, different value in the code
const groups = [];
for (const c of colors) {
  const g = groups.find((g) => dE(g[0].rgb, c.rgb) < 0.016);
  if (g) g.push(c);
  else groups.push([c]);
}
const dupes = groups.filter((g) => g.length > 1);

// contrast of each text on its real background
const fails = d.pairs.map((p) => ({ ...p, r: ratio(parse(p.fg), parse(p.bg)) })).filter((p) => p.r < (p.large ? 3 : 4.5)).sort((a, b) => a.r - b.r);

// ---------------------------------------------------------------- findings
const sw = (h) => `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${h};vertical-align:-2px;margin-right:4px;border:1px solid #ffffff22"></span>`;
const F = [];
for (const f of fails.slice(0, 3))
  F.push({
    level: "high",
    title: pt ? `Contraste ${f.r.toFixed(2)}:1 em “${f.sample.slice(0, 28)}”` : `Contrast ${f.r.toFixed(2)}:1 on “${f.sample.slice(0, 28)}”`,
    detail: `${sw(hex(parse(f.fg)))}<code>${hex(parse(f.fg))}</code> ${pt ? "sobre" : "on"} ${sw(hex(parse(f.bg)))}<code>${hex(parse(f.bg))}</code>, ${f.fs}px. ${pt ? `Precisa de ${f.large ? 3 : 4.5}:1 (WCAG AA).` : `Needs ${f.large ? 3 : 4.5}:1 (WCAG AA).`}`,
    fix: (() => {
      const lch = toLch(parse(f.fg));
      const bgL = toLch(parse(f.bg))[0];
      for (let L = lch[0]; L >= 0 && L <= 1; L += bgL > 0.5 ? -0.01 : 0.01) {
        const c = fromLch(L, lch[1], lch[2]);
        if (ratio(c, parse(f.bg)) >= (f.large ? 3 : 4.5)) return pt ? `A mesma cor um pouco mais ${bgL > 0.5 ? "escura" : "clara"}: ${sw(hex(c))}<code>${hex(c)}</code> (${ratio(c, parse(f.bg)).toFixed(2)}:1).` : `The same color a little ${bgL > 0.5 ? "darker" : "lighter"}: ${sw(hex(c))}<code>${hex(c)}</code> (${ratio(c, parse(f.bg)).toFixed(2)}:1).`;
      }
      return "";
    })(),
    ids: f.ids.slice(0, 2).map((i) => [i]),
  });
if (fails.length > 3) F.push({ level: "high", title: pt ? `Mais ${fails.length - 3} pares com pouco contraste` : `${fails.length - 3} more pairs with low contrast`, detail: fails.slice(3, 9).map((f) => `${sw(hex(parse(f.fg)))}${sw(hex(parse(f.bg)))}<code>${f.r.toFixed(2)}</code>`).join(" · "), fix: pt ? "Veja a tabela de contraste abaixo." : "See the contrast table below." });
if (dupes.length)
  F.push({
    level: "medium",
    title: pt ? (dupes.length > 1 ? `${dupes.length} grupos de cores quase iguais` : "Cores quase iguais") : (dupes.length > 1 ? `${dupes.length} groups of almost identical colors` : "Almost identical colors"),
    detail: dupes.slice(0, 5).map((g) => g.map((c) => `${sw(c.hex)}<code>${c.hex}</code> ×${c.n}`).join(" ")).join("<br>") + (pt ? "<br>Ninguém vê a diferença; o código mantém as duas pra sempre." : "<br>Nobody sees the difference; the code keeps both forever."),
    fix: pt ? "Fique com a mais usada de cada grupo e transforme em token." : "Keep the most used one in each group and make it a token.",
    ids: dupes.slice(0, 3).map((g) => g.map((c) => c.ids[0])),
  });
const total = d.literal + d.token;
if (total >= 15 && d.literal / total > 0.5)
  F.push({
    level: "medium",
    title: pt ? `${d.literal} cores escritas direto no CSS` : `${d.literal} colors written straight into the CSS`,
    detail: pt ? `${d.literal} de ${total} declarações de cor usam valores soltos em vez de variáveis (${d.token} usam tokens). Mudar a marca vira caça ao tesouro.` : `${d.literal} of ${total} color declarations use raw values instead of variables (${d.token} use tokens). Changing the brand becomes a treasure hunt.`,
    fix: pt ? "Tokens semânticos (<code>--bg</code>, <code>--text</code>, <code>--accent</code>…) em cima de uma escala; veja <code>palette.css</code>." : "Semantic tokens (<code>--bg</code>, <code>--text</code>, <code>--accent</code>…) on top of a scale; see <code>palette.css</code>.",
  });
const chromatic = groups.filter((g) => g[0].lch[1] > 0.04);
if (chromatic.length > 6) F.push({ level: "low", title: pt ? `${chromatic.length} cores com saturação` : `${chromatic.length} saturated colors`, detail: pt ? "Muitas cores fortes competem pela atenção; o destaque deixa de destacar." : "Many strong colors compete for attention; the accent stops standing out.", fix: pt ? "Uma cor de destaque, uma de apoio, e o resto neutro." : "One accent, one supporting color, and neutrals for the rest." });
if (!d.dark) F.push({ level: "low", title: pt ? "Sem modo escuro" : "No dark mode", detail: pt ? "Nenhuma regra <code>prefers-color-scheme: dark</code>. Não é obrigatório; se for fazer, os tokens abaixo já trazem a versão escura." : "No <code>prefers-color-scheme: dark</code> rule. Not required; if you want one, the tokens below include the dark version.", fix: pt ? "Tokens com valores claros e escuros, trocados por <code>@media (prefers-color-scheme: dark)</code>." : "Tokens with light and dark values, switched by <code>@media (prefers-color-scheme: dark)</code>." });

await shootFindings(page, F, out, "color");
await ctx.close();

// ---------------------------------------------------------------- the palette
const brand = (o.brand ? o.brand.split(",").map((s) => parse(s.trim())) : chromatic.sort((a, b) => b.reduce((n, c) => n + c.n, 0) - a.reduce((n, c) => n + c.n, 0)).slice(0, 2).map((g) => g[0].rgb)).slice(0, 3);
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const LS = [0.975, 0.94, 0.88, 0.8, 0.71, 0.63, 0.55, 0.47, 0.39, 0.31, 0.24];
const CF = [0.1, 0.22, 0.42, 0.65, 0.88, 1, 0.96, 0.86, 0.72, 0.56, 0.42];
const scale = (rgb, chromaOverride) => {
  const [L, C, H] = toLch(rgb);
  const c = chromaOverride ?? Math.max(C, 0.03);
  const s = STEPS.map((st, i) => ({ step: st, rgb: fromLch(LS[i], c * CF[i], H) }));
  // the brand color itself replaces its nearest step
  if (chromaOverride === undefined) {
    const k = LS.reduce((best, l, i) => (Math.abs(l - L) < Math.abs(LS[best] - L) ? i : best), 0);
    s[k] = { step: STEPS[k], rgb, brand: true };
  }
  return s;
};
const names = ["primary", "secondary", "tertiary"];
const scales = brand.map((b, i) => ({ name: names[i], hex: hex(b), steps: scale(b) }));
const neutral = { name: "neutral", steps: scale(brand[0] ?? [128, 128, 128], 0.012) };
const at = (sc, st) => sc.steps.find((s) => s.step === st).rgb;
const accentFor = (bg) => {
  for (const st of [500, 600, 700, 800]) if (ratio(at(scales[0], st), bg) >= 4.5) return st;
  return 800;
};
const accentDark = (bg) => {
  for (const st of [400, 300, 200]) if (ratio(at(scales[0], st), bg) >= 4.5) return st;
  return 200;
};
const lightBg = at(neutral, 50);
const darkBg = at(neutral, 950);
const sem = scales.length
  ? {
      light: { bg: at(neutral, 50), surface: at(neutral, 100), text: at(neutral, 950), "text-muted": at(neutral, 700), border: at(neutral, 200), accent: at(scales[0], accentFor(lightBg)), "on-accent": [255, 255, 255] },
      dark: { bg: darkBg, surface: at(neutral, 900), text: at(neutral, 50), "text-muted": at(neutral, 300), border: at(neutral, 800), accent: at(scales[0], accentDark(darkBg)), "on-accent": at(neutral, 950) },
    }
  : null;
const css = [
  `/* palette made by /coleoni-color from ${scales.map((s) => s.hex).join(", ") || "the page"} (OKLCH scales) */`,
  `:root {`,
  ...[...scales, neutral].flatMap((s) => s.steps.map((x) => `  --${s.name}-${x.step}: ${hex(x.rgb)};${x.brand ? " /* brand */" : ""}`)),
  ...(sem ? Object.keys(sem.light).map((k) => `  --${k}: var(--${(() => { const v = hex(sem.light[k]); for (const s of [...scales, neutral]) for (const x of s.steps) if (hex(x.rgb) === v) return `${s.name}-${x.step}`; return "x"; })()});`) : []),
  `}`,
  ...(sem ? [`@media (prefers-color-scheme: dark) {`, `  :root {`, ...Object.keys(sem.dark).map((k) => `    --${k}: ${hex(sem.dark[k])};`), `  }`, `}`] : []),
].join("\n");
writeFileSync(resolve(out, "palette.css"), css + "\n");

// ---------------------------------------------------------------- drawings
const inUse = `<div class="panel" style="display:flex;flex-wrap:wrap;gap:10px">${groups
  .sort((a, b) => b[0].lch[0] - a[0].lch[0])
  .map((g) => `<div style="display:flex;gap:2px;padding:4px;border-radius:12px;${g.length > 1 ? "outline:2px solid #ff6b5e;" : ""}">${g.map((c) => `<figure style="display:grid;gap:4px;width:70px"><div style="height:46px;border-radius:9px;background:${c.hex};border:1px solid #ffffff1a"></div><figcaption style="font:10.5px/1.3 ui-monospace,monospace;color:#c9cacf">${c.hex}<br><span style="color:#7c7e85">×${c.n} ${Object.keys(c.roles).map((r) => r[0]).join("")}</span></figcaption></figure>`).join("")}</div>`)
  .join("")}</div>`;
const pairsHtml = `<div class="panel" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${d.pairs
  .map((p) => ({ ...p, r: ratio(parse(p.fg), parse(p.bg)) }))
  .sort((a, b) => a.r - b.r)
  .slice(0, 24)
  .map((p) => { const ok = p.r >= (p.large ? 3 : 4.5); return `<div style="border-radius:10px;overflow:hidden;border:1px solid ${ok ? "#26272b" : "#5a2a26"}"><div style="background:${p.bg};color:${p.fg};padding:12px;font:600 ${p.large ? 22 : 15}px system-ui">Aa ${esc(p.sample.slice(0, 10))}</div><div style="padding:6px 10px;font:11.5px ui-monospace,monospace;color:${ok ? "#aefa0e" : "#ff8a7d"}">${p.r.toFixed(2)}:1 ${ok ? "AA" : "✗"}</div></div>`; })
  .join("")}</div>`;
const scaleHtml = `<div class="panel" style="display:grid;gap:10px">${[...scales, neutral]
  .map((s) => `<div style="display:grid;grid-template-columns:90px repeat(11,minmax(0,1fr));gap:4px;align-items:center"><span style="font:12px ui-monospace,monospace;color:#c9cacf">${s.name}</span>${s.steps.map((x) => `<div title="${hex(x.rgb)}" style="height:44px;border-radius:7px;background:${hex(x.rgb)};display:grid;place-items:end start;padding:4px;font:9.5px ui-monospace,monospace;color:${toLch(x.rgb)[0] > 0.6 ? "#111" : "#fff"};${x.brand ? "outline:2px solid #aefa0e;outline-offset:1px" : ""}">${x.step}</div>`).join("")}</div>`)
  .join("")}</div>`;
const semCard = (mode, t) => `<div style="background:${hex(t.bg)};border-radius:14px;padding:18px;display:grid;gap:10px;border:1px solid ${hex(t.border)}"><span style="font:600 11px system-ui;letter-spacing:.08em;text-transform:uppercase;color:${hex(t["text-muted"])}">${mode}</span><div style="background:${hex(t.surface)};border:1px solid ${hex(t.border)};border-radius:10px;padding:14px;display:grid;gap:6px"><b style="font:600 18px Georgia,serif;color:${hex(t.text)}">${pt ? "Bolo pra sábado" : "A cake for Saturday"}</b><span style="font:14px system-ui;color:${hex(t["text-muted"])}">${pt ? "Texto secundário" : "Muted text"} · ${ratio(t["text-muted"], t.surface).toFixed(1)}:1</span><span style="justify-self:start;margin-top:4px;background:${hex(t.accent)};color:${hex(t["on-accent"])};border-radius:999px;padding:7px 14px;font:600 13px system-ui">${pt ? "Botão" : "Button"} · ${ratio(t["on-accent"], t.accent).toFixed(1)}:1</span></div></div>`;
const semHtml = sem ? `<div class="panel" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${semCard(pt ? "Claro" : "Light", sem.light)}${semCard(pt ? "Escuro" : "Dark", sem.dark)}</div>` : "";

const high = F.filter((f) => f.level === "high").length;
const med = F.filter((f) => f.level === "medium").length;
const html = report({
  lang: o.lang,
  kicker: pt ? "Cor" : "Color",
  title: target.name,
  sub: o.select !== "body" ? o.select : "",
  chips: [[fails.length, pt ? "pares sem contraste" : "low-contrast pairs", "r"], [dupes.length, pt ? "grupos quase iguais" : "near-duplicate groups", "y"], [colors.length, pt ? "cores em uso" : "colors in use"], [`${d.token}/${total}`, pt ? "declarações com token" : "declarations with tokens"]],
  findings: F,
  sections: [
    { title: pt ? "Cores em uso" : "Colors in use", note: pt ? "contornadas em vermelho, as quase iguais · t texto, b fundo, i ícone" : "near-duplicates outlined in red · t text, b background, i icon", html: inUse, first: true },
    { title: pt ? "Contraste de cada texto" : "Contrast of every text", note: pt ? "no fundo real, do pior pro melhor" : "on its real background, worst first", html: pairsHtml },
    { title: pt ? "Paleta proposta" : "Proposed palette", note: pt ? "escalas OKLCH a partir da marca (contorno verde) · palette.css" : "OKLCH scales from the brand (green outline) · palette.css", html: scaleHtml },
    ...(sem ? [{ title: pt ? "Tokens semânticos" : "Semantic tokens", note: pt ? "claro e escuro, contraste conferido" : "light and dark, contrast checked", html: semHtml }] : []),
  ],
  made: pt ? "Feito pela /coleoni-color · skills.coleoni.com" : "Made by /coleoni-color · skills.coleoni.com",
});
await writeReport(out, html, { skill: "coleoni-color", page: target.name, findings: F, colors: colors.map((c) => ({ hex: c.hex, n: c.n, roles: c.roles, oklch: c.lch.map((v) => Math.round(v * 1000) / 1000) })), duplicates: dupes.map((g) => g.map((c) => c.hex)), contrast: d.pairs.map((p) => ({ fg: hex(parse(p.fg)), bg: hex(parse(p.bg)), ratio: Math.round(ratio(parse(p.fg), parse(p.bg)) * 100) / 100 })), tokens: { declared: d.tokens, literal: d.literal, token: d.token }, palette: "palette.css" }, `# Color: ${target.name}\n\n${mdFindings(F, o.lang)}\n`, browser);
await browser.close();
target.close();
console.log(`${fails.length} low-contrast pairs, ${dupes.length} near-duplicate groups, ${colors.length} colors`);
console.log(`ok ${join(out, "report.html")}`);
