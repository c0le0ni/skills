#!/usr/bin/env node
/**
 * Coleoni · the whole interface review in one pass.
 *
 *   node interface.mjs <url | folder | file.html> --out <folder> [--lang pt]
 *
 * Runs the family installed next to this skill (coleoni-polish, coleoni-type,
 * coleoni-color, coleoni-layout, and coleoni-copy and coleoni-a11y when they
 * are there) on the same page, then merges every finding into one report,
 * ordered by severity, each tagged with the skill that found it, with one
 * card per area linking to its full report.
 * Writes report.html, report.png, report.json, report.md and one folder per area.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, launch, parseArgs, report, writeReport, mdFindings } from "./lib.mjs";

const HELP = `
node interface.mjs <url|folder|file> --out <folder> [options]

  --only polish,type   run only these areas (polish, type, color, layout, copy, a11y)
  --lang en|pt         language of the reports
`;
const o = parseArgs(process.argv.slice(2), { out: "interface-report", only: "", lang: "en" }, HELP);
if (!o._.length) {
  console.log(HELP);
  process.exit(1);
}
const pt = o.lang === "pt";
const out = resolve(o.out);
const target = o._[0];
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = resolve(HERE, "..", "..");

const AREAS = [
  { key: "polish", script: "polish.mjs", name: ["Polish", "Acabamento"] },
  { key: "type", script: "type.mjs", name: ["Typography", "Tipografia"] },
  { key: "color", script: "color.mjs", name: ["Color", "Cor"] },
  { key: "layout", script: "layout.mjs", name: ["Layout", "Layout"] },
  { key: "copy", script: "copy.mjs", name: ["Copy", "Texto"], optional: true },
  { key: "a11y", script: "a11y.mjs", name: ["Accessibility", "Acessibilidade"], optional: true },
];
const only = o.only ? o.only.split(",").map((s) => s.trim()) : null;

const results = [];
for (const a of AREAS) {
  if (only && !only.includes(a.key)) continue;
  const dir = join(SKILLS, `coleoni-${a.key}`);
  const script = join(dir, "scripts", a.script);
  if (!existsSync(script)) {
    results.push({ ...a, missing: true });
    console.log(`  ${a.key.padEnd(7)} not installed`);
    continue;
  }
  if (!existsSync(join(dir, "node_modules"))) spawnSync("npm", ["install", "--silent"], { cwd: dir, shell: true, stdio: "ignore" });
  const sub = join(out, a.key);
  const args = a.key === "copy" ? [script, target, "--out", sub, "--pages", "1"] : a.key === "a11y" ? [script, target, "--out", sub, "--pages", "1", "--lang", o.lang] : [script, target, "--out", sub, "--lang", o.lang];
  const run = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 600000 });
  const ok = run.status === 0;
  console.log(`  ${a.key.padEnd(7)} ${ok ? "done" : "failed"}`);
  results.push({ ...a, ok, dir: sub, err: ok ? "" : (run.stderr || run.stdout || "").trim().split("\n").slice(-2).join(" ") });
}

// ---------------------------------------------------------------- merge
const L = { block: "high", fix: "medium", look: "low" };
const findings = [];
for (const r of results.filter((x) => x.ok)) {
  const pre = (p) => `${r.key}/${p}`;
  if (["polish", "type", "color", "layout"].includes(r.key)) {
    const j = JSON.parse(readFileSync(join(r.dir, "report.json"), "utf8"));
    r.count = j.findings.length;
    for (const f of j.findings) findings.push({ ...f, skill: `coleoni-${r.key}`, shots: (f.shots ?? []).map(pre) });
  } else if (r.key === "a11y") {
    const j = JSON.parse(readFileSync(join(r.dir, "a11y.json"), "utf8"));
    // the same problem found by two skills is reported once, by the specialist
    const ran = (k) => results.some((x) => x.key === k && x.ok);
    const issues = j.issues.filter((it) => !(it.rule === "color-contrast" && ran("color")) && !(it.rule === "reflow" && ran("layout")));
    r.count = issues.length;
    for (const it of issues) findings.push({ level: L[it.sev] ?? "low", title: it.title, detail: esc(it.detail) + (it.sc?.length ? ` <code>WCAG ${it.sc.join(", ")}</code>` : ""), fix: esc(it.fixText ?? it.nodes?.find((n) => n.summary)?.summary ?? ""), shots: (it.nodes ?? []).filter((n) => n.shot).slice(0, 2).map((n) => pre(n.shot)), skill: "coleoni-a11y" });
  } else if (r.key === "copy") {
    const j = JSON.parse(readFileSync(join(r.dir, "copy.json"), "utf8"));
    const flagged = j.items.filter((i) => i.flags.length);
    r.count = flagged.length;
    const by = {};
    for (const i of flagged) for (const f of i.flags) (by[f.rule] ||= []).push(i);
    const NAMES = { hype: [pt ? "Exagero no texto" : "Hype in the copy", "medium"], vague: [pt ? "Botões vagos" : "Vague buttons", "medium"], long: [pt ? "Frases longas demais" : "Sentences too long", "low"], dash: [pt ? "Travessões" : "Em dashes", "low"], caps: [pt ? "Texto gritado em caixa-alta" : "Shouting in capitals", "low"], titlecase: [pt ? "Title Case" : "Title Case", "low"], empty: [pt ? "Títulos que não dizem nada" : "Headings that say nothing", "medium"], nolabel: [pt ? "Placeholder no lugar do rótulo" : "Placeholder used as a label", "medium"], exclaim: [pt ? "Exclamações" : "Exclamation marks", "low"], passive: [pt ? "Voz passiva" : "Passive voice", "low"], length: [pt ? "Título ou descrição fora do tamanho" : "Title or description length", "low"] };
    for (const [rule, items] of Object.entries(by)) {
      const [title, level] = NAMES[rule] ?? [rule, "low"];
      findings.push({ level, title: `${title} (${items.length})`, detail: items.slice(0, 3).map((i) => `“${esc(i.text.slice(0, 70))}”`).join("<br>"), fix: pt ? "Rode a <code>/coleoni-copy</code> pra reescrever na voz do projeto." : "Run <code>/coleoni-copy</code> to rewrite in the project's voice.", skill: "coleoni-copy" });
    }
  }
}

// ---------------------------------------------------------------- report
const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.level] - order[b.level]);
const c = (lv) => findings.filter((f) => f.level === lv).length;
const areaCards = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">${results
  .map((r) => {
    const mine = findings.filter((f) => f.skill === `coleoni-${r.key}`);
    const hi = mine.filter((f) => f.level === "high").length;
    const md = mine.filter((f) => f.level === "medium").length;
    const name = r.name[pt ? 1 : 0];
    if (r.missing) return `<div class="panel" style="display:grid;gap:6px;opacity:.75"><b>${name}</b><span style="font-size:12.5px;color:#8b8d94">${pt ? "não instalada" : "not installed"}</span><code style="font:11px ui-monospace,monospace;color:#aefa0e;overflow-wrap:anywhere">npx skills add c0le0ni/skills --skill coleoni-${r.key}</code></div>`;
    if (!r.ok) return `<div class="panel" style="display:grid;gap:6px"><b>${name}</b><span style="font-size:12.5px;color:#ff8a7d">${pt ? "falhou" : "failed"}: ${esc(r.err.slice(0, 120))}</span></div>`;
    const file = r.key === "copy" ? "copy.md" : "report.html";
    return `<a class="panel" href="${r.key}/${file}" style="display:grid;gap:8px;text-decoration:none;color:inherit"><b style="font-size:15px">${name}</b><span style="display:flex;gap:10px;font:600 22px system-ui"><span style="color:${hi ? "#ff8a7d" : "#6b6d74"}">${hi}</span><span style="color:${md ? "#ffc861" : "#6b6d74"}">${md}</span><span style="color:#8b8d94">${mine.length - hi - md}</span></span><span style="font-size:12px;color:#8b8d94">${mine.length ? (pt ? "ver o relatório" : "open the report") : pt ? "nada a corrigir" : "nothing to fix"} →</span></a>`;
  })
  .join("")}</div>`;
const name = (() => {
  if (/^[a-z]+:\/\//i.test(target)) return new URL(target).hostname;
  return resolve(target).split(/[\\/]/).filter(Boolean).pop();
})();
const html = report({
  lang: o.lang,
  kicker: pt ? "Revisão de interface" : "Interface review",
  title: name,
  chips: [[c("high"), pt ? "corrigir primeiro" : "fix first", "r"], [c("medium"), pt ? "corrigir" : "to fix", "y"], [c("low"), pt ? "vale olhar" : "worth a look"], [results.filter((r) => r.ok).length, pt ? "áreas revisadas" : "areas reviewed", "g"]],
  findings,
  sections: [{ title: pt ? "Por área" : "By area", note: pt ? "vermelho, amarelo e cinza: corrigir primeiro, corrigir, vale olhar" : "red, yellow and grey: fix first, fix, worth a look", html: areaCards, first: true }],
  made: pt ? "Feito pela /coleoni-interface · skills.coleoni.com" : "Made by /coleoni-interface · skills.coleoni.com",
});
const browser = await launch();
await writeReport(out, html, { skill: "coleoni-interface", page: name, areas: results.map(({ dir, ...r }) => r), findings }, `# ${pt ? "Revisão de interface" : "Interface review"}: ${name}\n\n${mdFindings(findings, o.lang)}\n`, browser);
await browser.close();
console.log(`\n${c("high")} fix first, ${c("medium")} to fix, ${c("low")} worth a look`);
console.log(`ok ${join(out, "report.html")}`);
