#!/usr/bin/env node
/**
 * Coleoni · interface finish: radii, shadows, spacing, buttons, icons, states.
 *
 *   node polish.mjs <url | folder | file.html> --out <folder> [--select main] [--lang pt]
 *
 * Reads the computed styles of every visible element and finds what makes an
 * interface look unfinished: too many corner radii, inner corners that don't
 * follow the outer ones, shadows with no system or too harsh, spacing off the
 * 4px grid, buttons that don't match, icons off the text's center, labels
 * not centered in their buttons, buttons with no hover, and things that look
 * clickable but aren't buttons. Shows the scales the page actually uses and
 * crops every problem. Writes report.html, report.png, report.json, report.md.
 */
import { join, resolve } from "node:path";
import { esc, launch, load, open, parseArgs, report, shootFindings, writeReport, mdFindings } from "./lib.mjs";

const HELP = `
node polish.mjs <url|folder|file> --out <folder> [options]

  --select "main"   only this part of the page (default: the whole page)
  --width 1280      viewport width
  --lang en|pt      language of the report
`;
const o = parseArgs(process.argv.slice(2), { out: "polish-report", select: "body", width: 1280, lang: "en", wait: 400 }, HELP);
if (!o._.length) {
  console.log(HELP);
  process.exit(1);
}
const pt = o.lang === "pt";
const out = resolve(o.out);

// ---------------------------------------------------------------- in the page
function analyze(sel) {
  const root = document.querySelector(sel) ?? document.body;
  let n = 0;
  const idOf = (el) => (el.dataset.cx ||= `p${++n}`);
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  };
  const els = [root, ...root.querySelectorAll("*")].filter((el) => !el.closest("svg") && !/^(SCRIPT|STYLE|BR|OPTION)$/.test(el.tagName) && vis(el));
  const painted = (cs) => cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.boxShadow !== "none" || parseFloat(cs.borderTopWidth) > 0 || cs.backgroundImage !== "none";
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  const add = (map, key, el) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(idOf(el));
  };

  const radii = new Map();
  const shadows = new Map();
  const spacing = new Map();
  const nested = [];
  for (const el of els) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const rad = px(cs.borderTopLeftRadius);
    if (rad > 0 && (painted(cs) || el.tagName === "IMG")) {
      const pill = rad >= Math.min(r.height, r.width) / 2 - 1;
      add(radii, pill ? "pill" : String(rad), el);
    }
    if (cs.boxShadow !== "none") add(shadows, cs.boxShadow, el);
    for (const prop of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap", "marginTop", "marginBottom"]) {
      const v = px(cs[prop]);
      if (!v || v < 0 || Number.isNaN(v)) continue;
      add(spacing, String(v), el);
    }
    // inner corners: a painted child sitting inside a rounded painted parent
    if (rad > 4 && painted(cs)) {
      for (const k of el.querySelectorAll(":scope > *, :scope > * > *")) {
        const kcs = getComputedStyle(k);
        const kr = px(kcs.borderTopLeftRadius);
        if (!kr || !(painted(kcs) || k.tagName === "IMG") || !vis(k)) continue;
        const q = k.getBoundingClientRect();
        const inset = Math.round(Math.min(q.left - r.left, q.top - r.top));
        if (inset < 4 || inset >= rad) continue;
        const ideal = Math.max(rad - inset, 0);
        if (kr > ideal + 3) nested.push({ outer: rad, inner: kr, inset, ideal, ids: [idOf(k)] });
      }
    }
  }

  // buttons and button-looking things
  const clickable = (el) => el.matches("a[href],button,[role=button],input[type=submit],input[type=button],summary,[onclick]");
  const buttonish = els.filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const text = el.innerText?.trim() ?? "";
    return r.top + scrollY >= 0 && r.left >= 0 && (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0) && text && text.length < 40 && r.height >= 24 && r.height <= 64 && r.width < 420 && !el.querySelector("p,h1,h2,h3,li,table,input,select") && (clickable(el) || /btn|button|cta|send|submit/i.test(el.className));
  });
  const buttons = buttonish.map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { id: idOf(el), real: clickable(el), h: Math.round(r.height), rad: r.height / 2 - 1 <= px(cs.borderTopLeftRadius) ? "pill" : px(cs.borderTopLeftRadius), fs: px(cs.fontSize), cursor: cs.cursor, tag: el.tagName.toLowerCase(), sel: el.className ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}` : el.tagName.toLowerCase() };
  });
  // label centered? icon on the text's center?
  const offCenter = [];
  const iconOff = [];
  for (const el of buttonish) {
    const range = document.createRange();
    const tn = [...el.childNodes].find((c) => c.nodeType === 3 && c.nodeValue.trim());
    if (!tn) continue;
    range.selectNodeContents(tn);
    const tr = range.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const top = tr.top - r.top - parseFloat(cs.borderTopWidth);
    const bottom = r.bottom - tr.bottom - parseFloat(cs.borderBottomWidth);
    if (Math.abs(top - bottom) > 2.5) offCenter.push({ id: idOf(el), d: Math.round((top - bottom) * 10) / 10 });
    const icon = el.querySelector("svg, img");
    if (icon) {
      const ir = icon.getBoundingClientRect();
      const d = ir.top + ir.height / 2 - (tr.top + tr.height / 2);
      if (Math.abs(d) > 1.5) iconOff.push({ id: idOf(el), d: Math.round(d * 10) / 10 });
    }
  }
  return {
    radii: [...radii].map(([k, ids]) => ({ k, n: ids.length, ids })),
    shadows: [...shadows].map(([k, ids]) => ({ k, n: ids.length, ids })),
    spacing: [...spacing].map(([k, ids]) => ({ k: Number(k), n: ids.length, ids })),
    nested,
    buttons,
    offCenter,
    iconOff,
  };
}

// ---------------------------------------------------------------- main
const target = await open(o._[0]);
const browser = await launch();
const { page, ctx } = await load(browser, target.url, { width: o.width, wait: o.wait });
const d = await page.evaluate(analyze, o.select);

// hover: does anything change when the pointer is over a button?
const noHover = [];
for (const b of d.buttons.filter((b) => b.real).slice(0, 14)) {
  const s = `[data-cx="${b.id}"]`;
  const look = () => page.evaluate((s) => {
    const el = document.querySelector(s);
    const cs = getComputedStyle(el);
    return [cs.backgroundColor, cs.color, cs.borderColor, cs.boxShadow, cs.transform, cs.textDecorationLine, cs.opacity, cs.filter].join("|");
  }, s);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(60);
  const before = await look();
  await page.hover(s, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(260);
  if ((await look()) === before) noHover.push(b);
}
await page.mouse.move(1, 1);

// ---------------------------------------------------------------- findings
const F = [];
const radiiReal = d.radii.filter((r) => r.k !== "pill").sort((a, b) => Number(a.k) - Number(b.k));
if (radiiReal.length > 4)
  F.push({
    level: "medium",
    title: pt ? `${radiiReal.length} raios de canto diferentes` : `${radiiReal.length} different corner radii`,
    detail: (pt ? "Em uso: " : "In use: ") + radiiReal.map((r) => `<code>${r.k}px</code> ×${r.n}`).join(", ") + (pt ? ". Valores parecidos (10, 12, 16) parecem erro, não escolha." : ". Close values (10, 12, 16) read as mistakes, not choices."),
    fix: pt ? "Uma escala de 3 ou 4 tokens (<code>--r-sm</code>, <code>--r-md</code>, <code>--r-lg</code>, <code>--r-pill</code>) e cada componente escolhe um." : "A scale of 3 or 4 tokens (<code>--r-sm</code>, <code>--r-md</code>, <code>--r-lg</code>, <code>--r-pill</code>), and each component picks one.",
    ids: radiiReal.slice(0, 3).map((r) => [r.ids[0]]),
  });
for (const x of d.nested.slice(0, 1))
  F.push({
    level: "medium",
    title: pt ? "Canto de dentro não acompanha o de fora" : "Inner corner doesn't follow the outer one",
    detail: pt ? `Um elemento com raio <code>${x.inner}px</code> dentro de um de <code>${x.outer}px</code>, a <code>${x.inset}px</code> da borda. Os dois cantos não ficam paralelos e o de dentro parece inchado.` : `An element with a <code>${x.inner}px</code> radius inside a <code>${x.outer}px</code> one, <code>${x.inset}px</code> from its edge. The corners aren't parallel and the inner one looks swollen.`,
    fix: pt ? `Raio de dentro = raio de fora − distância: <code>${x.outer} − ${x.inset} = ${x.ideal}px</code>, ou <code>calc(var(--r-lg) - var(--pad))</code>.` : `Inner radius = outer radius − the gap: <code>${x.outer} − ${x.inset} = ${x.ideal}px</code>, or <code>calc(var(--r-lg) - var(--pad))</code>.`,
    ids: d.nested.slice(0, 3).map((n) => n.ids),
  });
if (d.shadows.length > 3)
  F.push({
    level: "medium",
    title: pt ? `${d.shadows.length} sombras diferentes` : `${d.shadows.length} different shadows`,
    detail: pt ? "Cada card com uma sombra própria: a luz parece vir de lugares diferentes." : "Each card has its own shadow: the light seems to come from different places.",
    fix: pt ? "Duas ou três sombras como tokens (<code>--shadow-1</code> pra repouso, <code>--shadow-2</code> pra elevado), na cor da marca e não em preto puro." : "Two or three shadows as tokens (<code>--shadow-1</code> resting, <code>--shadow-2</code> raised), tinted with the brand instead of pure black.",
    ids: d.shadows.slice(0, 3).map((s) => [s.ids[0]]),
  });
const hard = d.shadows.filter((s) => /rgba\(0, 0, 0, 0\.[4-9]|rgba\(0, 0, 0, 1\)|rgb\(0, 0, 0\)/.test(s.k) && !/\d{2,}px \d{2,}px/.test(s.k));
if (hard.length)
  F.push({
    level: "medium",
    title: pt ? "Sombra preta e dura" : "A hard, black shadow",
    detail: pt ? `<code>${esc(hard[0].k)}</code>: preto com opacidade alta e pouco desfoque parece borda suja, não profundidade.` : `<code>${esc(hard[0].k)}</code>: black at high opacity with little blur reads as a dirty edge, not depth.`,
    fix: pt ? "Desfoque maior, opacidade baixa (6 a 15%) e a cor escura da marca no lugar do preto." : "More blur, low opacity (6 to 15%) and the brand's dark color instead of black.",
    ids: hard.slice(0, 2).map((s) => [s.ids[0]]),
  });
const off = d.spacing.filter((s) => s.k >= 3 && s.k % 4 !== 0 && s.k % 2 !== 0 || (s.k >= 3 && s.k % 4 === 2 && s.k > 12)).sort((a, b) => b.n - a.n);
if (off.length)
  F.push({
    level: off.length > 4 ? "medium" : "low",
    title: pt ? `${off.length} espaçamentos fora da grade de 4px` : `${off.length} spacings off the 4px grid`,
    detail: (pt ? "Valores como " : "Values like ") + off.slice(0, 8).map((s) => `<code>${s.k}px</code> ×${s.n}`).join(", ") + (pt ? ". Quase iguais aos vizinhos da escala, criam desalinhamentos de 1 a 3px." : ". Almost equal to their neighbors on the scale, they create 1 to 3px misalignments."),
    fix: pt ? "Uma escala de espaço em múltiplos de 4 (<code>4 8 12 16 24 32 48 64</code>) e tokens pra ela." : "A spacing scale in multiples of 4 (<code>4 8 12 16 24 32 48 64</code>) and tokens for it.",
    ids: off.slice(0, 3).map((s) => [s.ids[0]]),
  });
const kinds = new Map();
for (const b of d.buttons) {
  const k = `${b.h}|${b.rad}|${b.fs}`;
  if (!kinds.has(k)) kinds.set(k, []);
  kinds.get(k).push(b);
}
if (kinds.size > 2)
  F.push({
    level: "medium",
    title: pt ? `${kinds.size} tipos de botão que não combinam` : `${kinds.size} kinds of button that don't match`,
    detail: (pt ? "Altura, raio e tamanho de letra: " : "Height, radius and font size: ") + [...kinds.values()].map((v) => `<code>${v[0].h}px · ${v[0].rad === "pill" ? "pill" : v[0].rad + "px"} · ${v[0].fs}px</code>`).join(", ") + ".",
    fix: pt ? "Um componente de botão com variantes de cor (primário, secundário) e no máximo dois tamanhos, mesma altura e mesmo raio." : "One button component with color variants (primary, secondary) and at most two sizes, same height and radius.",
    ids: [...kinds.values()].slice(0, 3).map((v) => [v[0].id]),
  });
const fake = d.buttons.filter((b) => !b.real);
if (fake.length)
  F.push({
    level: "high",
    title: pt ? "Parece botão, mas não é" : "Looks like a button, isn't one",
    detail: pt ? `<code>${esc(fake[0].sel)}</code> tem cara de botão, mas é um <code>${fake[0].tag}</code>${fake[0].cursor !== "pointer" ? " com cursor de texto" : ""}: não recebe foco, não responde ao Enter e o leitor de tela não anuncia.` : `<code>${esc(fake[0].sel)}</code> looks like a button but is a <code>${fake[0].tag}</code>${fake[0].cursor !== "pointer" ? " with a text cursor" : ""}: it can't be focused, ignores Enter and screen readers don't announce it.`,
    fix: pt ? "Use <code>&lt;button type=\"submit\"&gt;</code> (ou <code>&lt;a href&gt;</code> se navega) com o mesmo estilo." : "Use <code>&lt;button type=\"submit\"&gt;</code> (or <code>&lt;a href&gt;</code> if it navigates) with the same style.",
    ids: fake.slice(0, 2).map((b) => [b.id]),
  });
if (noHover.length)
  F.push({
    level: "medium",
    title: pt ? `${noHover.length} botões sem estado de hover` : `${noHover.length} buttons with no hover state`,
    detail: pt ? "Nada muda quando o mouse passa por cima: o botão parece desligado." : "Nothing changes when the pointer is over them: they feel dead.",
    fix: pt ? "Um <code>:hover</code> sutil (fundo 6 a 10% mais escuro), <code>:active</code> com 1px pra baixo, e <code>transition</code> de 150ms só nas propriedades que mudam." : "A subtle <code>:hover</code> (background 6 to 10% darker), <code>:active</code> 1px down, and a 150ms <code>transition</code> on the properties that change.",
    ids: noHover.slice(0, 3).map((b) => [b.id]),
  });
if (d.iconOff.length)
  F.push({
    level: "medium",
    title: pt ? "Ícone fora do centro do texto" : "Icon off the text's center",
    detail: pt ? `O ícone está ${Math.abs(d.iconOff[0].d)}px ${d.iconOff[0].d > 0 ? "abaixo" : "acima"} do centro da linha de texto.` : `The icon sits ${Math.abs(d.iconOff[0].d)}px ${d.iconOff[0].d > 0 ? "below" : "above"} the center of the text line.`,
    fix: pt ? "Tire margens manuais do ícone e alinhe com <code>display:inline-flex; align-items:center</code> no botão." : "Remove manual margins on the icon and align with <code>display:inline-flex; align-items:center</code> on the button.",
    ids: d.iconOff.slice(0, 2).map((x) => [x.id]),
  });
if (d.offCenter.length)
  F.push({
    level: "low",
    title: pt ? "Texto fora do centro do botão" : "Label off the button's center",
    detail: pt ? `Padding de cima e de baixo diferentes: o texto fica ${Math.abs(d.offCenter[0].d)}px fora do centro.` : `Different top and bottom padding: the label sits ${Math.abs(d.offCenter[0].d)}px off center.`,
    fix: pt ? "Altura mínima fixa (<code>min-height: 44px</code>) com <code>align-items:center</code> e padding só nas laterais." : "A fixed <code>min-height: 44px</code> with <code>align-items:center</code> and padding on the sides only.",
    ids: d.offCenter.slice(0, 2).map((x) => [x.id]),
  });

await shootFindings(page, F, out, "polish");
await ctx.close();

// ---------------------------------------------------------------- the scales, drawn
const radiusSheet = `<div class="panel" style="display:flex;flex-wrap:wrap;gap:18px">${d.radii
  .sort((a, b) => (a.k === "pill" ? 999 : Number(a.k)) - (b.k === "pill" ? 999 : Number(b.k)))
  .map((r) => `<figure style="display:grid;gap:6px;justify-items:center"><div style="width:76px;height:56px;border:2px solid #aefa0e;border-radius:${r.k === "pill" ? "999px" : r.k + "px"};background:#1d1f24"></div><figcaption style="font:12px ui-monospace,monospace;color:#c9cacf">${r.k === "pill" ? "pill" : r.k + "px"} <span style="color:#7c7e85">×${r.n}</span></figcaption></figure>`)
  .join("")}</div>`;
const shadowSheet = `<div class="panel" style="display:flex;flex-wrap:wrap;gap:22px;background:#F6F0E6">${d.shadows.map((s, i) => `<figure style="display:grid;gap:8px;width:170px"><div style="height:80px;border-radius:12px;background:#FBF8F2;box-shadow:${s.k}"></div><figcaption style="font:11px ui-monospace,monospace;color:#4E6B59;overflow-wrap:anywhere">${esc(s.k.length > 70 ? s.k.slice(0, 70) + "…" : s.k)} ×${s.n}</figcaption></figure>`).join("")}</div>`;
const sp = d.spacing.filter((s) => s.k >= 2).sort((a, b) => a.k - b.k);
const maxN = Math.max(...sp.map((s) => s.n), 1);
const spacingSheet = `<div class="panel" style="display:flex;align-items:flex-end;gap:6px;min-height:170px;overflow-x:auto">${sp.map((s) => { const ok = s.k % 4 === 0 || s.k < 3; return `<div style="display:grid;justify-items:center;gap:4px;min-width:34px"><span style="font:11px ui-monospace,monospace;color:#7c7e85">${s.n}</span><div style="width:22px;height:${Math.max(4, (s.n / maxN) * 110)}px;border-radius:4px;background:${ok ? "#aefa0e" : "#ff6b5e"}"></div><span style="font:11.5px ui-monospace,monospace;color:${ok ? "#c9cacf" : "#ff8a7d"}">${s.k}</span></div>`; }).join("")}</div>`;

const high = F.filter((f) => f.level === "high").length;
const med = F.filter((f) => f.level === "medium").length;
const html = report({
  lang: o.lang,
  kicker: pt ? "Acabamento" : "Polish",
  title: target.name,
  sub: o.select !== "body" ? o.select : "",
  chips: [[high, pt ? "corrigir primeiro" : "fix first", "r"], [med, pt ? "corrigir" : "to fix", "y"], [d.radii.length, pt ? "raios" : "radii"], [d.shadows.length, pt ? "sombras" : "shadows"], [sp.filter((s) => s.k % 4 && s.k >= 3).length, pt ? "espaços fora da grade" : "off-grid spacings"]],
  findings: F,
  sections: [
    { title: pt ? "Raios em uso" : "Radii in use", note: pt ? "cada valor e quantas vezes aparece" : "every value and how often", html: radiusSheet },
    { title: pt ? "Sombras em uso" : "Shadows in use", html: shadowSheet },
    { title: pt ? "Espaçamentos em uso" : "Spacing in use", note: pt ? "em vermelho, fora da grade de 4px" : "in red, off the 4px grid", html: spacingSheet },
  ],
  made: pt ? "Feito pela /coleoni-polish · skills.coleoni.com" : "Made by /coleoni-polish · skills.coleoni.com",
});
await writeReport(out, html, { skill: "coleoni-polish", page: target.name, findings: F, scales: { radii: d.radii.map(({ ids, ...r }) => r), shadows: d.shadows.map(({ ids, ...s }) => s), spacing: sp.map(({ ids, ...s }) => s) } }, `# Polish: ${target.name}\n\n${mdFindings(F, o.lang)}\n`, browser);
await browser.close();
target.close();
console.log(`${high} fix first, ${med} to fix, ${F.length - high - med} worth a look`);
console.log(`ok ${join(out, "report.html")}`);
