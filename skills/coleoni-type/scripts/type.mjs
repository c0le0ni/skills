#!/usr/bin/env node
/**
 * Coleoni · typography: the scale, the fonts, the lines.
 *
 *   node type.mjs <url | folder | file.html> --out <folder> [--select main] [--lang pt]
 *
 * Reads every piece of visible text and checks: how many font sizes and how
 * close they are, fonts that are named but never load (the visitor sees the
 * fallback), bold or italic the browser fakes, line height for body text and
 * headings, line length, justified text, capitals without tracking, a lonely
 * word at the end of headings and paragraphs, and numbers that don't line up
 * in tables and prices. Draws the specimen the page actually uses.
 * Writes report.html, report.png, report.json, report.md.
 */
import { join, resolve } from "node:path";
import { esc, launch, load, open, parseArgs, report, shootFindings, writeReport, mdFindings, crop } from "./lib.mjs";

const HELP = `
node type.mjs <url|folder|file> --out <folder> [options]

  --select "main"   only this part of the page (default: the whole page)
  --width 1280      viewport width
  --lang en|pt      language of the report
`;
const o = parseArgs(process.argv.slice(2), { out: "type-report", select: "body", width: 1280, lang: "en", wait: 400 }, HELP);
if (!o._.length) {
  console.log(HELP);
  process.exit(1);
}
const pt = o.lang === "pt";
const out = resolve(o.out);

function analyze(sel) {
  const root = document.querySelector(sel) ?? document.body;
  let n = 0;
  const idOf = (el) => (el.dataset.cx ||= `t${++n}`);
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const own = (el) => [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("").replace(/\s+/g, " ").trim();
  const texts = [root, ...root.querySelectorAll("*")].filter((el) => !/^(SCRIPT|STYLE|OPTION|SELECT|SVG)$/i.test(el.tagName) && !el.closest("svg") && own(el).length > 1 && vis(el));
  const canvas = document.createElement("canvas").getContext("2d");
  // is a family really available? its text must measure differently from both generic fallbacks
  const available = new Map();
  const has = (fam) => {
    if (available.has(fam)) return available.get(fam);
    if (/^(serif|sans-serif|monospace|system-ui|cursive|fantasy|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(fam)) return available.set(fam, true).get(fam);
    const s = "AaBbGgQqRr 0123456789 mmmwwwiiilll";
    const w = (f) => ((canvas.font = `40px ${f}`), canvas.measureText(s).width);
    const ok = w(`"${fam}", monospace`) !== w("monospace") || w(`"${fam}", serif`) !== w("serif");
    available.set(fam, ok);
    return ok;
  };
  const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ""), weight: f.weight, style: f.style, status: f.status }));
  const covers = (w, range) => {
    const [a, b] = String(range).split(" ").map(Number);
    return b ? w >= a && w <= b : Math.abs(w - a) < 1;
  };
  const items = texts.map((el) => {
    const cs = getComputedStyle(el);
    const stack = cs.fontFamily.split(",").map((f) => f.trim().replace(/["']/g, ""));
    const shown = stack.find(has) ?? stack.at(-1);
    const fs = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
    const t = own(el);
    canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const avg = canvas.measureText(t.slice(0, 120)).width / Math.min(t.length, 120);
    const r = el.getBoundingClientRect();
    // lines and the width of the last one
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((q) => q.width > 1);
    const lines = [];
    for (const q of rects) {
      const line = lines.find((l) => Math.abs(l.top - q.top) < fs * 0.5);
      if (line) line.right = Math.max(line.right, q.right), line.left = Math.min(line.left, q.left);
      else lines.push({ top: q.top, left: q.left, right: q.right });
    }
    const lastW = lines.length ? lines.at(-1).right - lines.at(-1).left : 0;
    const lastWords = t.split(" ").slice(-1)[0];
    return {
      id: idOf(el), tag: el.tagName.toLowerCase(), text: t.slice(0, 80), len: t.length,
      family: stack[0], shown, fs: Math.round(fs * 10) / 10, weight: Number(cs.fontWeight), italic: cs.fontStyle !== "normal", lh: Math.round((lh / fs) * 100) / 100,
      ls: parseFloat(cs.letterSpacing) || 0, upper: cs.textTransform === "uppercase" || (t === t.toUpperCase() && /[A-Z]{4}/.test(t)),
      align: cs.textAlign, wrap: cs.textWrap || cs.textWrapStyle || "", nums: cs.fontVariantNumeric, cpl: Math.round(r.width / avg), lines: lines.length,
      widow: lines.length >= 2 && lastW < r.width * 0.22 && !/\s/.test(lastWords) && lastWords.length < 14,
      inTable: !!el.closest("td,th") || /price|total|amount|valor|preco|preço/i.test(el.className + " " + (el.parentElement?.className ?? "")),
      digits: /\d/.test(t),
    };
  });
  const synth = [];
  for (const it of items) {
    const ff = faces.filter((f) => f.family.toLowerCase() === it.shown.toLowerCase());
    if (!ff.length) continue;
    if (!ff.some((f) => covers(it.weight, f.weight))) synth.push({ id: it.id, family: it.shown, weight: it.weight });
    else if (it.italic && !ff.some((f) => f.style !== "normal")) synth.push({ id: it.id, family: it.shown, weight: "italic" });
  }
  // fonts with no @font-face that only some systems have: fine for whoever built the page, wrong for visitors
  const SAFE = /^(arial|helvetica|helvetica neue|georgia|times|times new roman|verdana|tahoma|trebuchet ms|courier|courier new|segoe ui|roboto|san francisco|sf pro text|sf pro display|menlo|monaco|consolas|ui-monospace|sfmono-regular|liberation sans|noto sans|apple color emoji|segoe ui emoji)$/i;
  const local = [...new Set(items.map((i) => i.family))].filter((f) => has(f) && !SAFE.test(f) && !/^(serif|sans-serif|monospace|system-ui|cursive|fantasy|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(f) && !faces.some((x) => x.family.toLowerCase() === f.toLowerCase()));
  return { items, faces: faces.map((f) => `${f.family} ${f.weight} ${f.style} (${f.status})`), synth, local };
}

const target = await open(o._[0]);
const browser = await launch();
const { page, ctx } = await load(browser, target.url, { width: o.width, wait: o.wait });
const d = await page.evaluate(analyze, o.select);
const items = d.items;

// ---------------------------------------------------------------- findings
const F = [];
const missing = [...new Map(items.filter((i) => i.family !== i.shown).map((i) => [i.family, i])).values()];
for (const m of missing)
  F.push({
    level: "high",
    title: pt ? `“${m.family}” nunca carrega` : `“${m.family}” never loads`,
    detail: pt ? `O CSS pede <code>${esc(m.family)}</code>, mas a fonte não está instalada nem tem <code>@font-face</code>: quem visita vê <code>${esc(m.shown)}</code>. Na sua máquina pode parecer certo, se ela estiver instalada.` : `The CSS asks for <code>${esc(m.family)}</code>, but it's neither installed nor loaded with <code>@font-face</code>: visitors see <code>${esc(m.shown)}</code>. It may look right on your machine if you have it installed.`,
    fix: pt ? "Sirva a fonte (woff2 no próprio domínio, só os pesos usados, <code>font-display: swap</code>) ou assuma a fonte de sistema na pilha." : "Serve the font (woff2 from your own domain, only the weights in use, <code>font-display: swap</code>) or make the system font the stack on purpose.",
    ids: [[m.id]],
  });
for (const f of d.local) {
  const ex = items.find((i) => i.family === f);
  F.push({
    level: "high",
    title: pt ? `“${f}” só aparece pra quem tem ela instalada` : `“${f}” only shows for people who have it installed`,
    detail: pt ? `O CSS pede <code>${esc(f)}</code> sem <code>@font-face</code>. Nesta máquina ela está instalada, então parece certo; pra maioria das visitas cai na próxima fonte da pilha.` : `The CSS asks for <code>${esc(f)}</code> with no <code>@font-face</code>. It's installed on this machine, so it looks right here; most visitors get the next font in the stack.`,
    fix: pt ? "Sirva a fonte (woff2 no próprio domínio, só os pesos usados, <code>font-display: swap</code>) ou tire da pilha e assuma a fonte de sistema." : "Serve it (woff2 from your own domain, only the weights in use, <code>font-display: swap</code>) or drop it from the stack and use the system font on purpose.",
    ids: [[ex.id]],
  });
}
if (d.synth.length)
  F.push({
    level: "medium",
    title: pt ? "Negrito ou itálico falsificado pelo navegador" : "Bold or italic faked by the browser",
    detail: pt ? `<code>${esc(d.synth[0].family)}</code> é usada em ${d.synth[0].weight}, mas esse peso não foi carregado: o navegador engrossa ou inclina as letras sozinho, e fica borrado.` : `<code>${esc(d.synth[0].family)}</code> is used at ${d.synth[0].weight}, but that weight isn't loaded: the browser smears or slants the letters itself.`,
    fix: pt ? "Carregue o peso usado ou troque pelo peso carregado mais próximo; <code>font-synthesis: none</code> evita a falsificação." : "Load the weight in use or switch to the nearest loaded one; <code>font-synthesis: none</code> stops the faking.",
    ids: d.synth.slice(0, 2).map((s) => [s.id]),
  });
const sizes = [...new Set(items.map((i) => Math.round(i.fs * 2) / 2))].sort((a, b) => a - b);
const close = [];
for (let i = 1; i < sizes.length; i++) if (sizes[i] - sizes[i - 1] <= 1.5 && sizes[i] / sizes[i - 1] < 1.08) close.push([sizes[i - 1], sizes[i]]);
if (sizes.length > 7 || close.length)
  F.push({
    level: "medium",
    title: pt ? `${sizes.length} tamanhos de letra${close.length ? `, ${close.length} quase iguais` : ""}` : `${sizes.length} font sizes${close.length ? `, ${close.length} almost equal` : ""}`,
    detail: (pt ? "Em uso: " : "In use: ") + sizes.map((s) => `<code>${s}</code>`).join(" ") + (close.length ? (pt ? ". Pares que ninguém distingue: " : ". Pairs nobody can tell apart: ") + close.map(([a, b]) => `${a}/${b}`).join(", ") : "") + ".",
    fix: pt ? "Uma escala de 5 a 7 passos com razão constante (1,2 a 1,33), em tokens <code>rem</code>: por exemplo 13 · 15 · 17 · 21 · 28 · 44." : "A scale of 5 to 7 steps with a steady ratio (1.2 to 1.33), as <code>rem</code> tokens: for example 13 · 15 · 17 · 21 · 28 · 44.",
    ids: close.slice(0, 2).flatMap(([a, b]) => [[items.find((i) => Math.round(i.fs * 2) / 2 === a).id], [items.find((i) => Math.round(i.fs * 2) / 2 === b).id]]),
  });
const body = items.filter((i) => i.len > 90 && i.fs < 22 && /^(p|li|dd|blockquote|td|div|span)$/.test(i.tag));
const tight = body.filter((i) => i.lh < 1.35);
if (tight.length) F.push({ level: "medium", title: pt ? "Entrelinha apertada no texto corrido" : "Tight line height in body text", detail: pt ? `<code>${tight[0].lh}</code> em texto de ${tight[0].fs}px: as linhas se grudam e o olho se perde na volta.` : `<code>${tight[0].lh}</code> on ${tight[0].fs}px text: lines stick together and the eye loses its way back.`, fix: pt ? "Entre 1,45 e 1,65 pro texto corrido." : "Between 1.45 and 1.65 for body text.", ids: tight.slice(0, 2).map((i) => [i.id]) });
const long = body.filter((i) => i.cpl > 85 && i.lines >= 2);
if (long.length) F.push({ level: "medium", title: pt ? "Linhas longas demais" : "Lines too long", detail: pt ? `Cerca de ${long[0].cpl} caracteres por linha. Acima de 75, ler cansa e o olho erra a próxima linha.` : `About ${long[0].cpl} characters per line. Past 75, reading tires and the eye misses the next line.`, fix: pt ? "<code>max-width: 34em</code> (cerca de 65 caracteres) nos parágrafos." : "<code>max-width: 34em</code> (about 65 characters) on paragraphs.", ids: long.slice(0, 2).map((i) => [i.id]) });
const headLoose = items.filter((i) => i.fs >= 28 && i.lh > 1.3 && i.lines >= 2);
if (headLoose.length) F.push({ level: "low", title: pt ? "Título com entrelinha de parágrafo" : "Headings spaced like paragraphs", detail: pt ? `Título de ${headLoose[0].fs}px com <code>${headLoose[0].lh}</code>: as linhas se separam e o título vira dois.` : `A ${headLoose[0].fs}px heading at <code>${headLoose[0].lh}</code>: the lines drift apart and one heading reads as two.`, fix: pt ? "1,05 a 1,2 em títulos grandes." : "1.05 to 1.2 for large headings.", ids: [[headLoose[0].id]] });
const just = items.filter((i) => i.align === "justify" && i.len > 60);
if (just.length) F.push({ level: "low", title: pt ? "Texto justificado" : "Justified text", detail: pt ? "Sem hifenização, a web abre buracos entre as palavras pra encher a linha." : "Without hyphenation, the web opens gaps between words to fill each line.", fix: pt ? "<code>text-align: start</code>." : "<code>text-align: start</code>.", ids: [[just[0].id]] });
const caps = items.filter((i) => i.upper && i.len < 40 && i.ls < i.fs * 0.03);
if (caps.length) F.push({ level: "low", title: pt ? "Caixa-alta sem espaçamento" : "Capitals without tracking", detail: pt ? "Letras maiúsculas pequenas grudam umas nas outras sem um pouco de espaço entre elas." : "Small capitals crowd each other without a little space between them.", fix: pt ? "<code>letter-spacing: .06em</code> a <code>.1em</code> em rótulos em caixa-alta." : "<code>letter-spacing: .06em</code> to <code>.1em</code> on uppercase labels.", ids: caps.slice(0, 2).map((i) => [i.id]) });
const bigTrack = items.filter((i) => i.fs >= 40 && i.ls > 0);
if (bigTrack.length) F.push({ level: "low", title: pt ? "Título grande com espaçamento aberto" : "Large heading with open tracking", detail: pt ? `Em ${bigTrack[0].fs}px as letras já parecem afastadas; espaçamento positivo afasta mais.` : `At ${bigTrack[0].fs}px letters already look apart; positive tracking pushes them further.`, fix: pt ? "<code>letter-spacing: -0.01em</code> a <code>-0.025em</code> em títulos grandes." : "<code>letter-spacing: -0.01em</code> to <code>-0.025em</code> on large headings.", ids: [[bigTrack[0].id]] });
const widows = items.filter((i) => i.widow && /^h[1-4]$/.test(i.tag) && !/balance/.test(i.wrap));
if (widows.length) F.push({ level: "low", title: pt ? "Palavra sozinha na última linha do título" : "A lonely word on the heading's last line", detail: pt ? `“…${esc(widows[0].text.split(" ").slice(-3).join(" "))}”: a última linha com uma palavra só deixa o título torto.` : `“…${esc(widows[0].text.split(" ").slice(-3).join(" "))}”: one word alone on the last line leaves the heading lopsided.`, fix: pt ? "<code>text-wrap: balance</code> nos títulos e <code>text-wrap: pretty</code> nos parágrafos." : "<code>text-wrap: balance</code> on headings and <code>text-wrap: pretty</code> on paragraphs.", ids: [[widows[0].id]] });
const nums = items.filter((i) => i.inTable && i.digits && !/tabular/.test(i.nums));
if (nums.length >= 3) F.push({ level: "low", title: pt ? "Números que não se alinham" : "Numbers that don't line up", detail: pt ? "Preços e valores em colunas com algarismos de larguras diferentes: os dígitos não ficam um embaixo do outro." : "Prices and amounts in columns with proportional digits: they don't stack under each other.", fix: pt ? "<code>font-variant-numeric: tabular-nums</code> em tabelas, preços e totais." : "<code>font-variant-numeric: tabular-nums</code> on tables, prices and totals.", ids: [nums.slice(0, 4).map((i) => i.id)] });

await shootFindings(page, F, out, "type", 4);

// the specimen: one real example of every size, cropped from the page
const specimen = [];
for (const s of [...sizes].reverse()) {
  const ex = items.filter((i) => Math.round(i.fs * 2) / 2 === s).sort((a, b) => b.len - a.len)[0];
  const count = items.filter((i) => Math.round(i.fs * 2) / 2 === s).length;
  const file = `shots/size-${String(s).replace(".", "_")}.jpg`;
  const ok = await crop(page, [ex.id], join(out, file), { pad: 6, max: [700, 140], outline: false }).catch(() => null);
  specimen.push({ s, count, ex, file: ok ? file : null });
}
await ctx.close();
const fams = [...new Map(items.map((i) => [`${i.shown}`, items.filter((x) => x.shown === i.shown)])).entries()];
const specHtml = `<div class="panel" style="display:grid;gap:0;padding:0">${specimen
  .map((x) => `<div style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px;align-items:center;padding:12px 18px;border-top:1px solid #222327"><div style="font:12px/1.5 ui-monospace,monospace;color:#c9cacf"><b style="font-size:15px;color:${close.some((c) => c.includes(x.s)) ? "#ff8a7d" : "#aefa0e"}">${x.s}px</b><br>${esc(x.ex.shown)} ${x.ex.weight}<br>lh ${x.ex.lh} · ×${x.count}</div>${x.file ? `<img src="${x.file}" alt="" style="max-width:100%;max-height:110px;justify-self:start;border-radius:6px">` : `<span style="color:#8b8d94">${esc(x.ex.text)}</span>`}</div>`)
  .join("")}</div>`;
const famHtml = `<div class="panel" style="display:flex;flex-wrap:wrap;gap:10px">${fams.map(([f, list]) => `<span style="border:1px solid #2a2b30;border-radius:999px;padding:5px 12px;font-size:13px">${esc(f)} · ${[...new Set(list.map((l) => l.weight))].sort().join(", ")} · ×${list.length}</span>`).join("")}${missing.map((m) => `<span style="border:1px solid #5a2a26;color:#ff8a7d;border-radius:999px;padding:5px 12px;font-size:13px">${esc(m.family)} → ${esc(m.shown)}</span>`).join("")}</div>`;
const high = F.filter((f) => f.level === "high").length;
const med = F.filter((f) => f.level === "medium").length;
const html = report({
  lang: o.lang,
  kicker: pt ? "Tipografia" : "Typography",
  title: target.name,
  sub: o.select !== "body" ? o.select : "",
  chips: [[high, pt ? "corrigir primeiro" : "fix first", "r"], [med, pt ? "corrigir" : "to fix", "y"], [sizes.length, pt ? "tamanhos" : "sizes"], [fams.length, pt ? "famílias na tela" : "families on screen"]],
  findings: F,
  sections: [
    { title: pt ? "Famílias e pesos na tela" : "Families and weights on screen", note: pt ? "o que quem visita realmente vê" : "what visitors actually see", html: famHtml, first: true },
    { title: pt ? "A escala em uso" : "The scale in use", note: pt ? "um exemplo real de cada tamanho, recortado da página" : "a real example of each size, cropped from the page", html: specHtml },
  ],
  made: pt ? "Feito pela /coleoni-type · skills.coleoni.com" : "Made by /coleoni-type · skills.coleoni.com",
});
await writeReport(out, html, { skill: "coleoni-type", page: target.name, findings: F, sizes, families: fams.map(([f, l]) => ({ family: f, weights: [...new Set(l.map((x) => x.weight))] })), missing: missing.map((m) => ({ asked: m.family, shown: m.shown })), faces: d.faces }, `# Typography: ${target.name}\n\nSizes: ${sizes.join(", ")}\n\n${mdFindings(F, o.lang)}\n`, browser);
await browser.close();
target.close();
console.log(`${high} fix first, ${med} to fix, ${F.length - high - med} worth a look`);
console.log(`ok ${join(out, "report.html")}`);
