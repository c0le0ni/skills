#!/usr/bin/env node
/**
 * Coleoni · one-page overview of a project set up by /coleoni-init.
 *
 *   node overview.mjs <project folder> [--accent "#hex"] [--out file.html]
 *
 * Reads README, AGENTS, docs/ROADMAP, docs/STATUS, docs/design-system,
 * docs/adr/README and docs/glossary, and writes a self-contained HTML page
 * (default: <project>/docs/overview.html). No dependencies.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HELP = `
node overview.mjs <project folder> [options]

  --accent "#hex"   accent color (default: --accent from docs/design-system.md, else #2f6fed)
  --out <file>      output file (default: <project>/docs/overview.html)
`;

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
let dir = null;
let accentArg = null;
let outArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--help") {
    console.log(HELP);
    process.exit(0);
  } else if (args[i] === "--accent") accentArg = args[++i];
  else if (args[i] === "--out") outArg = args[++i];
  else if (!args[i].startsWith("--")) dir = args[i];
  else {
    console.error(`unknown option: ${args[i]}`);
    process.exit(1);
  }
}
if (!dir) {
  console.log(HELP);
  process.exit(1);
}
const root = resolve(dir);
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n") : "");

// ---------------------------------------------------------------- markdown helpers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

/** Text under a "## Heading" (until the next ##). */
function section(md, title) {
  const re = new RegExp(`^##\\s+${title}\\s*$`, "im");
  const m = md.match(re);
  if (!m) return "";
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^##\s/m);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

/** Rows of the first markdown table in a block, without the header. */
function tableRows(block) {
  const rows = block.split("\n").filter((l) => /^\s*\|/.test(l));
  return rows
    .slice(2)
    .map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
}

const firstParagraph = (block) => (block.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#") && !p.trim().startsWith(">") && !p.trim().startsWith("|")) || "").replace(/\n/g, " ").trim();
const listItems = (block) => block.split("\n").filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l)).map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+(\[[ xX]\]\s+)?/, "").trim());
const isPlaceholder = (s) => /^<.*>$/.test(s.trim()) || /^\*?pending/i.test(s.trim());

// ---------------------------------------------------------------- read the project
const readme = read("README.md");
const agents = read("AGENTS.md");
const roadmap = read("docs/ROADMAP.md");
const status = read("docs/STATUS.md");
const design = read("docs/design-system.md");
const adrs = read("docs/adr/README.md");
const glossary = read("docs/glossary.md");

const name = ((readme.match(/^#\s+(.+)$/m) || agents.match(/^#\s+(.+)$/m) || [])[1] || relative(process.cwd(), root)).replace(/:\s*agent guide$/i, "").trim();
const tagline = firstParagraph(readme.replace(/^#.*$/m, ""));
const whatItIs = firstParagraph(section(agents, "What it is"));
const notList = listItems(section(agents, "What it is not")).filter((x) => !isPlaceholder(x));

const phases = [];
for (const m of roadmap.matchAll(/^##\s+(Phase\s+\d+[^\n]*)\n([\s\S]*?)(?=^##\s|(?![\s\S]))/gim)) {
  const body = m[2];
  const st = ((body.match(/\*\*Status:\*\*\s*(\w+)/i) || [])[1] || "next").toLowerCase();
  const items = body.split("\n").filter((l) => /^\s*-\s+\[[ xX]\]/.test(l));
  const done = items.filter((l) => /\[[xX]\]/.test(l)).length;
  const [num, ...rest] = m[1].split(":");
  phases.push({ num: num.trim(), title: rest.join(":").trim(), status: st, items: items.map((l) => l.replace(/^\s*-\s+\[[ xX]\]\s+/, "")), done });
}

const colors = tableRows(section(design, "Colors"))
  .map((r) => ({ token: r[0]?.replace(/`/g, ""), value: (r[1] || "").replace(/`/g, ""), use: r[2] || "" }))
  .filter((c) => /^#[0-9a-f]{3,8}$/i.test(c.value));
const type = tableRows(section(design, "Type")).filter((r) => r[1] && !isPlaceholder(r[1]));
const decisions = tableRows(adrs).filter((r) => /^\d{3,4}$/.test(r[0]));
const blockers = listItems(section(status, "Blockers")).filter((x) => !isPlaceholder(x));
const terms = tableRows(glossary).filter((r) => r[0] && !isPlaceholder(r[0]));

const docs = [];
const walk = (d) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (f.startsWith(".") || f === "node_modules") continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".md") && !f.startsWith("_")) {
      const h = (readFileSync(p, "utf8").match(/^#\s+(.+)$/m) || [])[1] || "";
      docs.push({ path: relative(root, p).replace(/\\/g, "/"), title: h });
    }
  }
};
walk(root);

const tokenAccent = colors.find((c) => c.token === "--accent")?.value;
const accent = accentArg || tokenAccent || "#2f6fed";
if (!/^#[0-9a-f]{3,8}$/i.test(accent)) {
  console.error(`--accent must be a hex color, got ${accent}`);
  process.exit(1);
}

// ---------------------------------------------------------------- page
const font = readFileSync(join(HERE, "..", "fonts", "geist-latin.woff2")).toString("base64");
const label = { done: "Done", now: "Now", next: "Next" };
const pending = (txt) => `<p class="pending">${txt}</p>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · overview</title>
<style>
@font-face { font-family: "Geist"; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format("woff2"); }
:root { --accent: ${accent}; --ink: #16171a; --ink-2: #4a4d55; --ink-3: #80838c; --line: #e6e7ea; --bg: #f4f4f5; --card: #ffffff; --soft: color-mix(in srgb, var(--accent) 9%, white); }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 14px/1.55 "Geist", system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
.page { max-width: 1120px; margin: 0 auto; padding: 48px 32px 64px; display: grid; gap: 20px; }
header { display: grid; gap: 10px; padding-bottom: 8px; }
.kicker { font: 500 11.5px/1 ui-monospace, "SF Mono", Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0; font-size: 40px; line-height: 1.05; letter-spacing: -.03em; font-weight: 620; }
.tagline { margin: 0; font-size: 17px; color: var(--ink-2); max-width: 70ch; }
.grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; align-items: start; }
.card { grid-column: span 6; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; display: grid; gap: 12px; align-content: start; }
.card.wide { grid-column: span 12; }
.card.third { grid-column: span 4; }
.card.two { grid-column: span 8; }
h2 { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h2 b { font: 500 11px ui-monospace, "SF Mono", Consolas, monospace; color: var(--ink-3); letter-spacing: 0; text-transform: none; }
p { margin: 0; color: var(--ink-2); }
code { font: 12.5px ui-monospace, "SF Mono", Consolas, monospace; background: #f1f2f4; padding: 1px 5px; border-radius: 4px; }
.pending { color: var(--ink-3); font-style: italic; }
ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.not li { display: flex; gap: 10px; color: var(--ink-2); }
.not li::before { content: ""; flex: none; width: 10px; height: 2px; margin-top: 10px; background: var(--ink-3); }
.phases { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.phase { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; display: grid; gap: 8px; align-content: start; background: #fcfcfd; }
.phase.now { border-color: var(--accent); background: var(--soft); }
.phase .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-3); }
.phase strong { font-size: 15px; line-height: 1.3; }
.pill { display: inline-flex; align-items: center; gap: 6px; font: 500 11px ui-monospace, "SF Mono", Consolas, monospace; text-transform: uppercase; letter-spacing: .05em; }
.pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); }
.pill.now { color: var(--accent); } .pill.now::before { background: var(--accent); box-shadow: 0 0 0 3px var(--soft); }
.pill.done { color: #1f8a4c; } .pill.done::before { background: #1f8a4c; }
.bar { height: 4px; border-radius: 4px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); }
.phase ul { gap: 3px; font-size: 13px; color: var(--ink-2); }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.sw { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.sw i { display: block; height: 56px; }
.sw div { padding: 8px 10px; display: grid; gap: 1px; }
.sw b { font: 500 12px ui-monospace, "SF Mono", Consolas, monospace; }
.sw span { font: 11.5px ui-monospace, "SF Mono", Consolas, monospace; color: var(--ink-3); }
.type { display: grid; gap: 6px; }
.type div { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); padding-top: 6px; }
.type span { color: var(--ink-3); font-size: 12.5px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
td { padding: 8px 0; border-top: 1px solid var(--line); vertical-align: top; color: var(--ink-2); }
td:first-child { font: 500 12px ui-monospace, "SF Mono", Consolas, monospace; color: var(--ink); width: 64px; }
td:last-child { text-align: right; white-space: nowrap; }
.todo { font: 500 11px ui-monospace, "SF Mono", Consolas, monospace; text-transform: uppercase; color: #b4560f; }
.todo.ok { color: #1f8a4c; }
ol { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--ink-2); }
ol li::marker { color: var(--accent); font-weight: 600; }
.terms { display: flex; flex-wrap: wrap; gap: 6px; }
.terms span { border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; font-size: 12.5px; background: #fcfcfd; }
.docs li { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); padding-top: 6px; font-size: 13px; }
.docs code { background: none; padding: 0; color: var(--ink); }
.docs span { color: var(--ink-3); text-align: right; }
footer { color: var(--ink-3); font-size: 12px; }
@media (max-width: 860px) {
  .page { padding: 28px 16px 40px; }
  h1 { font-size: 30px; }
  .card, .card.third, .card.two { grid-column: span 12; }
}
</style>
</head>
<body>
<main class="page">
<header>
<span class="kicker">Project overview</span>
<h1>${esc(name)}</h1>
${tagline ? `<p class="tagline">${inline(tagline)}</p>` : ""}
</header>
<div class="grid">

<section class="card two">
<h2>What it is</h2>
${whatItIs && !isPlaceholder(whatItIs) ? `<p>${inline(whatItIs)}</p>` : pending("Not written yet (AGENTS.md).")}
</section>

<section class="card third">
<h2>What it is not <b>${notList.length}</b></h2>
${notList.length ? `<ul class="not">${notList.map((x) => `<li><span>${inline(x)}</span></li>`).join("")}</ul>` : pending("Nothing cut yet.")}
</section>

<section class="card wide">
<h2>Roadmap <b>${phases.filter((p) => p.status === "done").length} of ${phases.length} done</b></h2>
${
  phases.length
    ? `<div class="phases">${phases
        .map(
          (p) => `<div class="phase ${p.status}">
<div class="top"><span>${esc(p.num)}</span><span class="pill ${p.status}">${label[p.status] || esc(p.status)}</span></div>
<strong>${inline(p.title)}</strong>
${p.items.length ? `<div class="bar"><i style="width:${Math.round((p.done / p.items.length) * 100)}%"></i></div><ul>${p.items.slice(0, 5).map((x) => `<li>${inline(x)}</li>`).join("")}${p.items.length > 5 ? `<li>+${p.items.length - 5} more</li>` : ""}</ul>` : ""}
</div>`,
        )
        .join("")}</div>`
    : pending("No phases found in docs/ROADMAP.md.")
}
</section>

<section class="card two">
<h2>Palette <b>${colors.length} tokens</b></h2>
${
  colors.length
    ? `<div class="swatches">${colors.map((c) => `<div class="sw"><i style="background:${c.value}"></i><div><b>${esc(c.token)}</b><span>${esc(c.value)}</span></div></div>`).join("")}</div>`
    : pending("Pending: no tokens in docs/design-system.md.")
}
</section>

<section class="card third">
<h2>Type</h2>
${type.length ? `<div class="type">${type.map((r) => `<div><strong>${inline(r[0])}</strong><span>${inline(r[1])}${r[2] && !isPlaceholder(r[2]) ? ` · ${inline(r[2])}` : ""}</span></div>`).join("")}</div>` : pending("Pending.")}
</section>

<section class="card">
<h2>Decisions <b>${decisions.filter((d) => /to record|proposed/i.test(d[2] || "")).length} open</b></h2>
${
  decisions.length
    ? `<table>${decisions.map((d) => `<tr><td>${esc(d[0])}</td><td>${inline(d[1] || "")}</td><td><span class="todo${/accepted/i.test(d[2] || "") ? " ok" : ""}">${esc(d[2] || "")}</span></td></tr>`).join("")}</table>`
    : pending("No decisions listed in docs/adr/README.md.")
}
</section>

<section class="card">
<h2>Blockers <b>${blockers.length}</b></h2>
${blockers.length ? `<ol>${blockers.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>` : pending("Nothing blocking.")}
</section>

<section class="card">
<h2>Glossary <b>${terms.length} terms</b></h2>
${terms.length ? `<div class="terms">${terms.map((r) => `<span title="${esc(r[1] || "")}">${esc(r[0])}</span>`).join("")}</div>` : pending("No terms yet.")}
</section>

<section class="card">
<h2>Documents <b>${docs.length}</b></h2>
<ul class="docs">${docs.map((d) => `<li><code>${esc(d.path)}</code><span>${inline(d.title)}</span></li>`).join("")}</ul>
</section>

</div>
<footer>Generated from the project docs by coleoni-init. Edit the docs, not this page.</footer>
</main>
</body>
</html>`;

const out = resolve(outArg || join(root, "docs", "overview.html"));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log("ok", out);
console.log(`phases ${phases.length} · tokens ${colors.length} · decisions ${decisions.length} · blockers ${blockers.length} · terms ${terms.length} · documents ${docs.length}`);
