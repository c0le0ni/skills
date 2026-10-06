#!/usr/bin/env node
/**
 * Coleoni · layout: alignment, rhythm, grouping and widths.
 *
 *   node layout.mjs <url | folder | file.html> --out <folder> [--lang pt]
 *
 * Measures where every block of content starts and finds edges that almost
 * line up but don't (off by 1 to 6px), the vertical rhythm between sections,
 * headings that sit closer to the block above than to their own content, and
 * how the page behaves at 390, 768 and 1280px. Draws the edges and gaps on
 * the page itself. Writes report.html, report.png, report.json, report.md.
 */
import { join, resolve } from "node:path";
import { esc, launch, load, open, parseArgs, report, shootFindings, writeReport, mdFindings } from "./lib.mjs";

const HELP = `
node layout.mjs <url|folder|file> --out <folder> [options]

  --select "main"   only this part of the page (default: the whole page)
  --width 1280      desktop viewport width
  --lang en|pt      language of the report
`;
const o = parseArgs(process.argv.slice(2), { out: "layout-report", select: "body", width: 1280, lang: "en", wait: 400 }, HELP);
if (!o._.length) {
  console.log(HELP);
  process.exit(1);
}
const pt = o.lang === "pt";
const out = resolve(o.out);

function analyze(sel) {
  const root = document.querySelector(sel) ?? document.body;
  let n = 0;
  const idOf = (el) => (el.dataset.cx ||= `l${++n}`);
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  const sx = scrollX;
  const sy = scrollY;
  // content blocks: headings, paragraphs, lists, forms, tables, cards, media
  const blocks = [...root.querySelectorAll("h1,h2,h3,h4,p,ul,ol,table,form,figure,img,blockquote,article,[class*=card],[class*=eyebrow],[class*=actions],nav,header > a")].filter((el) => vis(el) && !el.closest("nav a") && el.getBoundingClientRect().width > 30);
  const outer = blocks.filter((el) => !blocks.some((b) => b !== el && b.contains(el) && /^(ARTICLE|FORM|TABLE|FIGURE)$/.test(b.tagName)));
  const edges = new Map();
  for (const el of outer) {
    const x = Math.round(el.getBoundingClientRect().left + sx);
    if (!edges.has(x)) edges.set(x, []);
    edges.get(x).push(idOf(el));
  }
  // top-level sections and the gaps between them
  const kids = [...(root.querySelector("main") ?? root).children].filter((el) => vis(el) && !/^(SCRIPT|STYLE)$/.test(el.tagName));
  let top = kids;
  if (kids.length === 1) top = [...kids[0].children].filter(vis);
  const secs = top.map((el) => ({ id: idOf(el), y: Math.round(el.getBoundingClientRect().top + sy), b: Math.round(el.getBoundingClientRect().bottom + sy), x: Math.round(el.getBoundingClientRect().left + sx), w: Math.round(el.getBoundingClientRect().width), tag: el.tagName.toLowerCase() }));
  const gaps = [];
  for (let i = 1; i < secs.length; i++) gaps.push({ a: secs[i - 1].id, b: secs[i].id, gap: secs[i].y - secs[i - 1].b, y: secs[i - 1].b });
  // headings: closer to their content than to what came before?
  const floaters = [];
  for (const h of root.querySelectorAll("h2,h3")) {
    if (!vis(h)) continue;
    const r = h.getBoundingClientRect();
    let prev = h.previousElementSibling;
    let next = h.nextElementSibling;
    const prevBottom = prev && vis(prev) ? prev.getBoundingClientRect().bottom : h.parentElement.previousElementSibling ? h.parentElement.previousElementSibling.getBoundingClientRect().bottom : null;
    const nextTop = next && vis(next) ? next.getBoundingClientRect().top : null;
    if (prevBottom == null || nextTop == null) continue;
    const above = r.top - prevBottom;
    const below = nextTop - r.bottom;
    if (above > 0 && below > 0 && below >= above * 0.75 && below > 14) floaters.push({ id: idOf(h), above: Math.round(above), below: Math.round(below), text: h.innerText.trim().slice(0, 40) });
  }
  // the widest text block, in characters
  return {
    edges: [...edges].map(([x, ids]) => ({ x, n: ids.length, ids })).sort((a, b) => a.x - b.x),
    secs,
    gaps,
    floaters,
    docW: document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight,
  };
}

// draw the edges and the section gaps over the page
function overlay({ edges, near, gaps }) {
  const layer = document.createElement("div");
  layer.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${document.documentElement.scrollHeight}px;pointer-events:none;z-index:2147483646`;
  for (const e of edges) {
    const l = document.createElement("div");
    const bad = near.includes(e.x);
    l.style.cssText = `position:absolute;top:0;bottom:0;left:${e.x}px;width:0;border-left:${bad ? "2px solid rgba(255,59,107,.9)" : "1px dashed rgba(70,160,40,.55)"}`;
    const tag = document.createElement("span");
    tag.textContent = `${e.x}`;
    tag.style.cssText = `position:absolute;top:${bad ? 4 : 22}px;left:3px;font:600 11px ui-monospace,monospace;color:#fff;background:${bad ? "#ff3b6b" : "#3d8b1f"};padding:1px 4px;border-radius:4px`;
    l.appendChild(tag);
    layer.appendChild(l);
  }
  for (const g of gaps) {
    if (g.gap <= 0) continue;
    const b = document.createElement("div");
    b.style.cssText = `position:absolute;left:0;right:0;top:${g.y}px;height:${g.gap}px;background:rgba(80,140,255,.12);border-top:1px solid rgba(80,140,255,.5);border-bottom:1px solid rgba(80,140,255,.5)`;
    const tag = document.createElement("span");
    tag.textContent = `${g.gap}px`;
    tag.style.cssText = `position:absolute;right:8px;top:50%;transform:translateY(-50%);font:600 11px ui-monospace,monospace;color:#fff;background:#3b6fd8;padding:1px 5px;border-radius:4px`;
    b.appendChild(tag);
    layer.appendChild(b);
  }
  document.body.appendChild(layer);
}

const target = await open(o._[0]);
const browser = await launch();
const { page, ctx } = await load(browser, target.url, { width: o.width, wait: o.wait });
const d = await page.evaluate(analyze, o.select);

// ---------------------------------------------------------------- findings
const F = [];
// near misses: an edge 1 to 6px from a more used edge
const near = [];
for (const e of d.edges) {
  const bigger = d.edges.find((f) => f !== e && Math.abs(f.x - e.x) > 0 && Math.abs(f.x - e.x) <= 6 && f.n >= e.n);
  if (bigger) near.push({ ...e, to: bigger.x, off: e.x - bigger.x });
}
if (near.length)
  F.push({
    level: "medium",
    title: pt ? `${near.length} bordas quase alinhadas` : `${near.length} edges that almost line up`,
    detail: near.slice(0, 6).map((e) => (pt ? `<code>${e.x}px</code> em vez de <code>${e.to}px</code> (${e.off > 0 ? "+" : ""}${e.off}px, ${e.n} bloco${e.n > 1 ? "s" : ""})` : `<code>${e.x}px</code> instead of <code>${e.to}px</code> (${e.off > 0 ? "+" : ""}${e.off}px, ${e.n} block${e.n > 1 ? "s" : ""})`)).join("<br>") + (pt ? "<br>Ninguém nota o número; todo mundo sente a página torta." : "<br>Nobody notices the number; everyone feels the page is crooked."),
    fix: pt ? "Um contêiner só (<code>max-width</code> + <code>margin-inline: auto</code> + um <code>padding-inline</code> em token) pra todas as seções, em vez de padding por seção." : "One container (<code>max-width</code> + <code>margin-inline: auto</code> + one <code>padding-inline</code> token) for every section, instead of padding per section.",
    ids: near.slice(0, 3).map((e) => [e.ids[0], d.edges.find((f) => f.x === e.to).ids[0]]),
  });
const gapVals = d.gaps.map((g) => g.gap).filter((g) => g > 8);
const distinct = [...new Set(gapVals)].sort((a, b) => a - b);
const uneven = distinct.length > 2 && distinct.at(-1) - distinct[0] > 8 && distinct.some((v, i) => i && v - distinct[i - 1] <= 10);
if (uneven)
  F.push({
    level: "medium",
    title: pt ? "Espaço entre seções sem ritmo" : "No rhythm between sections",
    detail: (pt ? "Distâncias entre seções: " : "Gaps between sections: ") + d.gaps.filter((g) => g.gap > 8).map((g) => `<code>${g.gap}px</code>`).join(" → ") + (pt ? ". Valores quase iguais parecem engano." : ". Values this close look like mistakes."),
    fix: pt ? "Um único espaço de seção em token (por exemplo <code>--s-8: 64px</code>), e um maior só onde o assunto muda de verdade." : "One section spacing token (for example <code>--s-8: 64px</code>), and a bigger one only where the subject really changes.",
  });
for (const f of d.floaters.slice(0, 2))
  F.push({
    level: "low",
    title: pt ? `Título solto: “${f.text}”` : `A floating heading: “${f.text}”`,
    detail: pt ? `${f.above}px acima e ${f.below}px abaixo: o título fica tão perto do bloco anterior quanto do próprio conteúdo, e não fica claro a quem pertence.` : `${f.above}px above and ${f.below}px below: the heading is as close to the block before as to its own content, so it's unclear what it belongs to.`,
    fix: pt ? "Mais espaço acima do título que abaixo (algo como 2:1)." : "More space above the heading than below (about 2:1).",
    ids: [[f.id]],
  });

// widths: does the page hold at phone and tablet?
const widths = [];
for (const [w, phone] of [[390, true], [768, false]]) {
  const r = await load(browser, target.url, { width: w, height: 900, wait: 200, phone });
  const res = await r.page.evaluate(() => {
    const extra = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    let el = null;
    if (extra > 2) {
      const c = [...document.querySelectorAll("body *")].find((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 2 && getComputedStyle(e).position !== "fixed");
      el = c ? c.tagName.toLowerCase() + (typeof c.className === "string" && c.className ? "." + c.className.split(" ")[0] : "") : null;
    }
    return { extra, el };
  });
  const file = `shots/width-${w}.jpg`;
  await r.page.screenshot({ path: join(out, file), type: "jpeg", quality: 80, fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(await r.page.evaluate(() => document.documentElement.scrollHeight), 2600) } }).catch(() => r.page.screenshot({ path: join(out, file), type: "jpeg", quality: 80 }));
  await r.ctx.close();
  widths.push({ w, ...res, file });
  if (res.extra > 2) F.push({ level: "high", title: pt ? `Rola pro lado em ${w}px` : `Scrolls sideways at ${w}px`, detail: pt ? `${res.extra}px a mais que a tela${res.el ? `, a partir de <code>${esc(res.el)}</code>` : ""}.` : `${res.extra}px wider than the screen${res.el ? `, starting at <code>${esc(res.el)}</code>` : ""}.`, fix: pt ? "Colunas com <code>repeat(auto-fill, minmax(min(100%, 16rem), 1fr))</code>, <code>min-width: 0</code> em filhos de flex, tabelas dentro de um contêiner com <code>overflow-x: auto</code>." : "Columns with <code>repeat(auto-fill, minmax(min(100%, 16rem), 1fr))</code>, <code>min-width: 0</code> on flex children, tables inside an <code>overflow-x: auto</code> wrapper." });
}

await shootFindings(page, F, out, "layout", 2);
// the overlay on the desktop page
await page.evaluate(overlay, { edges: d.edges.filter((e) => e.n >= 1), near: near.map((e) => e.x), gaps: d.gaps });
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: join(out, "shots/overlay.jpg"), type: "jpeg", quality: 82, fullPage: true, clip: { x: 0, y: 0, width: o.width, height: Math.min(d.docH, 3600) } });
await ctx.close();

const edgeHtml = `<div class="panel" style="padding:10px"><img src="shots/overlay.jpg" alt="" style="width:100%;display:block;border-radius:8px"></div>`;
const widthHtml = `<div class="panel" style="display:flex;gap:18px;align-items:flex-start;overflow-x:auto">${widths.map((w) => `<figure style="display:grid;gap:6px;flex:none;width:${w.w === 390 ? 220 : 330}px"><img src="${w.file}" alt="" style="width:100%;border-radius:10px;border:1px solid #26272b"><figcaption style="font:12px ui-monospace,monospace;color:${w.extra > 2 ? "#ff8a7d" : "#aefa0e"}">${w.w}px · ${w.extra > 2 ? (pt ? `rola ${w.extra}px pro lado` : `scrolls ${w.extra}px sideways`) : pt ? "cabe" : "fits"}</figcaption></figure>`).join("")}</div>`;
const high = F.filter((f) => f.level === "high").length;
const med = F.filter((f) => f.level === "medium").length;
const html = report({
  lang: o.lang,
  kicker: pt ? "Layout" : "Layout",
  title: target.name,
  sub: o.select !== "body" ? o.select : "",
  chips: [[high, pt ? "corrigir primeiro" : "fix first", "r"], [med, pt ? "corrigir" : "to fix", "y"], [d.edges.length, pt ? "bordas à esquerda" : "left edges"], [near.length, pt ? "quase alinhadas" : "near misses"]],
  findings: F,
  sections: [
    { title: pt ? "Bordas e espaços na página" : "Edges and gaps on the page", note: pt ? "verde: bordas em uso · vermelho: quase alinhadas · azul: espaço entre seções" : "green: edges in use · red: near misses · blue: gaps between sections", html: edgeHtml, first: true },
    { title: pt ? "Celular e tablet" : "Phone and tablet", html: widthHtml },
  ],
  made: pt ? "Feito pela /coleoni-layout · skills.coleoni.com" : "Made by /coleoni-layout · skills.coleoni.com",
});
await writeReport(out, html, { skill: "coleoni-layout", page: target.name, findings: F, edges: d.edges.map(({ ids, ...e }) => e), gaps: d.gaps.map((g) => g.gap), widths: widths.map(({ file, ...w }) => w) }, `# Layout: ${target.name}\n\n${mdFindings(F, o.lang)}\n`, browser);
await browser.close();
target.close();
console.log(`${high} fix first, ${med} to fix, ${F.length - high - med} worth a look`);
console.log(`ok ${join(out, "report.html")}`);
