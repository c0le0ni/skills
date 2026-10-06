#!/usr/bin/env node
/**
 * Coleoni · every state of a component, side by side.
 *
 *   node states.mjs <url | folder | file.html> --select ".orders" [--api "** /api/orders*"] --out <folder>
 *
 * Opens the real component and forces each state by intercepting its API
 * calls: loading (the response never arrives), empty (every list emptied),
 * one item, many items, missing fields (half the values null), server error,
 * offline and no permission. Without --api it records the JSON calls the page
 * makes and uses those. For each state it checks for a blank component, a
 * state that looks exactly like another (an error that spins like loading),
 * raw values (undefined, NaN, Invalid Date, [object Object]), an error that
 * doesn't say what happened, and crashes in the console. Writes states.html
 * (tabs and a grid), states.png, states.md and states.json.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ALL = ["ready", "loading", "empty", "one", "many", "partial", "error", "offline", "denied"];
const HELP = `
node states.mjs <url|folder|file> --select "<css selector>" --out <folder> [options]

  --select ".orders"     the component (default: main, then body)
  --api "**/api/x*"      API calls to control (glob, repeatable; default: the JSON calls the page makes)
  --states a,b           only these (default: all) ${ALL.join(", ")}
  --width 1280           viewport width
  --lang en|pt           language of the sheet
  --wait 1200            how long to wait in each state before the screenshot, in ms
`;

function parseArgs(argv) {
  const o = { target: null, select: null, api: [], states: ALL, out: "states-report", width: 1280, lang: "en", wait: 1200 };
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
      case "--select": o.select = val(); break;
      case "--api": o.api.push(val()); break;
      case "--states": o.states = val().split(",").map((s) => s.trim()).filter((s) => ALL.includes(s)); break;
      case "--out": o.out = val(); break;
      case "--width": o.width = Number(val()); break;
      case "--lang": o.lang = val() === "pt" ? "pt" : "en"; break;
      case "--wait": o.wait = Number(val()); break;
      default:
        console.error(`unknown option: ${a}`);
        process.exit(1);
    }
  }
  if (!o.target) {
    console.log(HELP);
    process.exit(1);
  }
  if (!o.states.includes("ready")) o.states.unshift("ready");
  return o;
}
const fail = (m) => {
  console.error(m);
  process.exit(1);
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".json": "application/json" };
function serve(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      let file = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!file.startsWith(root)) file = root;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file) && existsSync(`${file}.json`)) file = `${file}.json`;
      if (!existsSync(file)) {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end('{"error":"not found"}');
      }
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

// ---------------------------------------------------------------- shaping the data
const walk = (v, fn) => (Array.isArray(v) ? fn(v.map((x) => walk(x, fn))) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, fn)])) : v);
const shape = {
  empty: (data) => walk(data, (arr) => []),
  one: (data) => walk(data, (arr) => arr.slice(0, 1)),
  many: (data) =>
    walk(data, (arr) => {
      if (!arr.length) return arr;
      const out = [];
      for (let i = 0; out.length < 30; i++) {
        const x = arr[i % arr.length];
        out.push(x && typeof x === "object" && !Array.isArray(x) && "id" in x ? { ...x, id: typeof x.id === "number" ? x.id + 1000 * Math.floor(i / arr.length) : `${x.id}-${i}` } : x);
      }
      return out;
    }),
  // half the values of every object become null; ids and nested lists stay
  partial: (data) => {
    const nul = (v) => {
      if (Array.isArray(v)) return v.map(nul);
      if (v && typeof v === "object") {
        let i = 0;
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^(id|_id|key|uuid)$/i.test(k) || (x && typeof x === "object") ? nul(x) : i++ % 2 === 1 ? null : x]));
      }
      return v;
    };
    return nul(data);
  },
};

// ---------------------------------------------------------------- strings
const T = {
  en: {
    title: "Component states", all: "All states", ok: "ok", problem: "problem", look: "look",
    st: {
      ready: ["Ready", "The real data, as it arrives today."],
      loading: ["Loading", "The response never arrives: what the user sees while waiting."],
      empty: ["Empty", "Every list in the response is empty: a new account, a quiet day."],
      one: ["One item", "Every list with a single item."],
      many: ["Many items", "Every list with 30 items."],
      partial: ["Missing fields", "Half the values in each record are null: optional fields, old records."],
      error: ["Server error", "The API answers 500."],
      offline: ["Offline", "The request fails: no connection, a tunnel, a train."],
      denied: ["No permission", "The API answers 401: the session expired."],
    },
    why: { noload: "gives no sign that it is loading", noempty: "doesn't say there is nothing here, or what to do", blank: "shows nothing at all", same: "looks exactly like", raw: "shows raw values", crash: "crashes", silent: "doesn't say what happened or what to do", noapi: "no API call was intercepted", spinner: "keeps loading forever" },
    made: "Made by /coleoni-states · skills.coleoni.com",
  },
  pt: {
    title: "Estados do componente", all: "Todos os estados", ok: "ok", problem: "problema", look: "olhar",
    st: {
      ready: ["Pronto", "Os dados reais, como chegam hoje."],
      loading: ["Carregando", "A resposta nunca chega: o que a pessoa vê enquanto espera."],
      empty: ["Vazio", "Toda lista da resposta vazia: conta nova, dia parado."],
      one: ["Um item", "Toda lista com um item só."],
      many: ["Muitos itens", "Toda lista com 30 itens."],
      partial: ["Campos faltando", "Metade dos valores de cada registro nula: campos opcionais, registros antigos."],
      error: ["Erro no servidor", "A API responde 500."],
      offline: ["Sem internet", "A requisição falha: sem conexão, um túnel, um trem."],
      denied: ["Sem permissão", "A API responde 401: a sessão expirou."],
    },
    why: { noload: "não dá sinal de que está carregando", noempty: "não diz que não tem nada, nem o que fazer", blank: "não mostra nada", same: "fica igual a", raw: "mostra valores crus", crash: "quebra", silent: "não diz o que aconteceu nem o que fazer", noapi: "nenhuma chamada de API foi interceptada", spinner: "fica carregando pra sempre" },
    made: "Feito pela /coleoni-states · skills.coleoni.com",
  },
};

// ---------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
const t = T[o.lang];
const out = resolve(o.out);
mkdirSync(join(out, "shots"), { recursive: true });

let url = o.target;
let server = null;
if (!/^[a-z]+:\/\//i.test(url) && existsSync(resolve(url))) {
  const p = resolve(url);
  const root = statSync(p).isDirectory() ? p : resolve(p, "..");
  server = await serve(root);
  url = `http://127.0.0.1:${server.address().port}/${statSync(p).isDirectory() ? "" : p.slice(root.length + 1).replace(/\\/g, "/")}`;
} else if (!/^[a-z]+:\/\//i.test(url)) url = /^localhost|^127\./.test(url) ? `http://${url}` : `https://${url}`;
const sel = o.select ?? "main";
const browser = await launch();
const newCtx = () => browser.newContext({ viewport: { width: o.width, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });

// 1. the real load: which JSON calls does the component depend on, and what do they return
const real = new Map();
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  page.on("response", async (r) => {
    const rt = r.request().resourceType();
    if (!["fetch", "xhr"].includes(rt) || !/json/i.test(r.headers()["content-type"] ?? "")) return;
    try {
      real.set(r.url(), await r.json());
    } catch {}
  });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await ctx.close();
}
const toGlob = (u) => {
  const x = new URL(u);
  return `**${x.pathname}*`;
};
const patterns = o.api.length ? o.api : [...new Set([...real.keys()].map(toGlob))];
if (!patterns.length) console.log("no JSON calls seen; only the ready state will differ. Pass --api, or see SKILL.md for components without an API.");
console.log(`states of ${sel} on ${url}\napi: ${patterns.join(", ") || "(none)"}`);
const realFor = (u) => real.get(u) ?? [...real.entries()].find(([k]) => new URL(k).pathname === new URL(u).pathname)?.[1];

async function run(state) {
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text().split("\n")[0].slice(0, 160)));
  let hits = 0;
  for (const p of patterns)
    await page.route(p, async (route) => {
      const rt = route.request().resourceType();
      if (!["fetch", "xhr"].includes(rt)) return route.continue();
      hits++;
      if (state === "ready") return route.continue();
      if (state === "loading") return; // never answered
      if (state === "offline") return route.abort("internetdisconnected");
      if (state === "error") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal Server Error" }) });
      if (state === "denied") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
      let data = realFor(route.request().url());
      if (data === undefined) {
        const r = await route.fetch();
        data = await r.json().catch(() => null);
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shape[state](data)) });
    });
  await page.goto(url, { waitUntil: state === "loading" ? "domcontentloaded" : "load", timeout: 60000 }).catch(() => {});
  if (state !== "loading") await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(o.wait);
  const info = await page.evaluate((s) => {
    const root = document.querySelector(s) ?? document.querySelector("main") ?? document.body;
    const text = root.innerText.replace(/\s+/g, " ").trim();
    const busy = !!root.querySelector('[aria-busy="true"],[class*=skeleton],[class*=spinner],[class*=loading],[role=progressbar]') || root.getAttribute("aria-busy") === "true";
    const raw = (text.match(/\b(undefined|null|NaN|Invalid Date|\[object Object\])\b/g) ?? []).slice(0, 4);
    const media = !!root.querySelector("img,svg,canvas,video");
    const r = root.getBoundingClientRect();
    return { text: text.slice(0, 600), busy, raw: [...new Set(raw)], blank: !text && !media, h: Math.round(r.height) };
  }, sel);
  const handle = await page.$(sel);
  await handle?.scrollIntoViewIfNeeded().catch(() => {});
  // crop to what the content covers (viewport coordinates, as the clip expects)
  const box = await page.evaluate((s) => {
    const root = document.querySelector(s) ?? document.querySelector("main") ?? document.body;
    const r = root.getBoundingClientRect();
    let l = Infinity, tp = Infinity, rt = -Infinity, b = -Infinity;
    const rcs = getComputedStyle(root);
    const inner = r.width - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight);
    const walk = (el, depth) => {
      for (const k of el.children) {
        const q = k.getBoundingClientRect();
        if (q.width < 1 || q.height < 1 || /^(SCRIPT|STYLE)$/.test(k.tagName)) continue;
        // a block as wide as the root says little: look at what is inside it
        if (depth < 3 && q.width >= inner - 2 && k.children.length) walk(k, depth + 1);
        else {
          l = Math.min(l, q.left); tp = Math.min(tp, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
        }
      }
    };
    walk(root, 0);
    if (!isFinite(l)) return { x: r.left, y: r.top, width: r.width, height: r.height };
    return { x: l, y: Math.min(tp, r.top), width: rt - l, height: Math.max(b, Math.min(r.bottom, b + 40)) - Math.min(tp, r.top) };
  }, sel);
  const file = `shots/${state}.jpg`;
  if (box && box.width > 4 && box.height > 4) {
    const vp = page.viewportSize();
    const x = Math.max(0, box.x - 16);
    const y = Math.max(0, box.y - 16);
    await page.screenshot({ path: join(out, file), type: "jpeg", quality: 86, clip: { x, y, width: Math.min(vp.width - x, box.width + 32), height: Math.min(Math.max(box.height + 32, 60), 1400) } });
  } else await page.screenshot({ path: join(out, file), type: "jpeg", quality: 86 });
  await ctx.close();
  return { state, ...info, errors: [...new Set(errors)], hits, file, bytes: readFileSync(join(out, file)) };
}

const runs = [];
for (const s of o.states) {
  runs.push(await run(s));
  console.log(`  ${s}`);
}
await browser.close();
server?.close();

// ---------------------------------------------------------------- judge
const results = runs.map((r) => {
  const issues = [];
  const notes = [];
  if (r.state !== "ready" && patterns.length && !r.hits) notes.push(t.why.noapi);
  if (r.errors.length) issues.push(`${t.why.crash}: ${r.errors[0]}`);
  if (r.raw.length) issues.push(`${t.why.raw}: ${r.raw.join(", ")}`);
  if (r.blank) issues.push(t.why.blank);
  if (r.state === "loading" && !r.blank && !r.busy && !/loading|carregando|aguarde|please wait|un momento/i.test(r.text)) issues.push(t.why.noload);
  if (r.state === "empty" && !r.blank && !r.errors.length && !/\b(no|none|nothing|empty|yet|nenhum|nenhuma|nada|vazio|vazia|ainda)\b/i.test(r.text)) issues.push(t.why.noempty);
  const twin = r.errors.length ? null : runs.find((x) => x !== r && runs.indexOf(x) < runs.indexOf(r) && (x.bytes.equals(r.bytes) || (x.text && x.text === r.text)));
  if (twin && !r.blank && !["one"].includes(r.state)) (["error", "offline", "denied", "empty"].includes(r.state) ? issues : notes).push(`${t.why.same} “${t.st[twin.state][0]}”`);
  if (["error", "offline", "denied"].includes(r.state) && !r.blank) {
    if (r.busy) issues.push(t.why.spinner);
    else if (!/error|fail|couldn|can.t|unable|try|again|retry|offline|connection|sign in|log in|expired|permission|erro|falh|não foi|nao foi|tente|novamente|sem conex|entre|sess[aã]o|permiss/i.test(r.text)) notes.push(t.why.silent);
  }
  const status = issues.length ? "problem" : notes.length ? "look" : "ok";
  return { state: r.state, status, issues, notes, file: r.file, text: r.text.slice(0, 200), busy: r.busy };
});

const problems = results.filter((r) => r.status === "problem").length;
const site = (() => {
  try {
    const u = new URL(url);
    return u.hostname === "127.0.0.1" ? o.target.replace(/[\\/]+$/, "").split(/[\\/]/).pop() : u.hostname + u.pathname;
  } catch {
    return url;
  }
})();
const card = (r, big) => `<article class="${r.status}${big ? " big" : ""}"><header><b>${esc(t.st[r.state][0])}</b><em>${t[r.status]}</em></header><p>${esc(t.st[r.state][1])}</p><div class="shot"><img src="${r.file}" alt=""></div>${r.issues.length || r.notes.length ? `<ul>${r.issues.map((i) => `<li class="x">${esc(i)}</li>`).join("")}${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</article>`;
const tabs = [{ id: "all", label: t.all }, ...results.map((r) => ({ id: r.state, label: t.st[r.state][0], status: r.status }))];
const html = `<!doctype html><html lang="${o.lang === "pt" ? "pt-BR" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.title} · ${esc(site)}</title><style>
*{box-sizing:border-box;margin:0}
body{background:#111214;color:#e8e8ea;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:1480px;margin:0 auto;padding:44px 32px 56px;display:grid;gap:24px}
.k{font:600 12px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b8d94}
h1{font-size:40px;line-height:1.05;letter-spacing:-.025em;font-weight:650;margin-top:14px}
h1 span{color:#8b8d94}
.sum{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.sum span{border:1px solid #2a2b30;background:#16171a;border-radius:999px;padding:5px 12px;font-size:13px;color:#c9cacf}
.sum b{font-weight:650}.sum .r b{color:#ff8a7d}.sum .g b{color:#aefa0e}.sum code{font:12px ui-monospace,Consolas,monospace}
input{position:absolute;opacity:0;pointer-events:none}
.tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #26272b;padding-bottom:12px}
.tabs label{cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;border:1px solid #2a2b30;background:#16171a;color:#c9cacf;font-size:13.5px;font-weight:550}
.tabs label i{width:8px;height:8px;border-radius:50%;background:#aefa0e}
.tabs label i.problem{background:#ff6b5e}.tabs label i.look{background:#f5b84a}
.panel{display:none}
${tabs.map((x) => `#t-${x.id}:checked~.tabs label[for=t-${x.id}]{background:#e8e8ea;color:#111214;border-color:#e8e8ea}#t-${x.id}:checked~#p-${x.id}{display:grid}`).join("\n")}
#t-all:focus-visible~.tabs label[for=t-all]${tabs.slice(1).map((x) => `,#t-${x.id}:focus-visible~.tabs label[for=t-${x.id}]`).join("")}{outline:2px solid #aefa0e;outline-offset:2px}
.grid{grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px;align-items:start}
.one{grid-template-columns:minmax(0,900px)}
article{background:#16171a;border:1px solid #26272b;border-radius:14px;overflow:hidden;display:grid}
article.problem{border-color:#5a2a26}
header{display:flex;align-items:baseline;gap:10px;padding:13px 15px 0}
header b{font-size:15px;font-weight:620}
header em{margin-left:auto;font-style:normal;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;background:#20300c;color:#aefa0e}
.problem header em{background:#3a1715;color:#ff8a7d}.look header em{background:#2b2210;color:#ffc861}
article>p{color:#8b8d94;font-size:12.5px;padding:3px 15px 10px}
.shot{background:repeating-conic-gradient(#1a1b1f 0 25%,#16171a 0 50%) 0 0/16px 16px;border-top:1px solid #222327;border-bottom:1px solid #222327;display:grid;place-items:center;padding:10px;max-height:520px;overflow:hidden}
.big .shot{max-height:none}
.shot img{max-width:100%;max-height:500px;display:block;border-radius:6px}
.big .shot img{max-height:none}
ul{list-style:none;padding:10px 15px 13px;display:grid;gap:4px}
li{font-size:12.5px;color:#a9abb2;display:flex;gap:8px}
li:before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#f5b84a;margin-top:6px}
li.x{color:#ffb4ab}li.x:before{background:#ff6b5e}
.foot{color:#6b6d74;font-size:12.5px}
@media (max-width:760px){.w{padding:28px 16px 40px}h1{font-size:28px}.grid{grid-template-columns:minmax(0,1fr)}}
</style></head><body><div class="w">
<div><span class="k">${t.title} · ${new Date().toISOString().slice(0, 10)}</span><h1>${esc(site)} <span>${esc(sel)}</span></h1>
<div class="sum"><span class="r"><b>${problems}</b> ${o.lang === "pt" ? "estados com problema" : "states with problems"}</span><span class="g"><b>${results.filter((r) => r.status === "ok").length}</b> ok</span><span><b>${results.filter((r) => r.status === "look").length}</b> ${o.lang === "pt" ? "pra olhar" : "to look at"}</span>${patterns.length ? `<span>API <code>${esc(patterns.join(", "))}</code></span>` : ""}</div></div>
${tabs.map((x, i) => `<input type="radio" name="tab" id="t-${x.id}"${i === 0 ? " checked" : ""}>`).join("")}
<div class="tabs" role="tablist">${tabs.map((x) => `<label for="t-${x.id}">${x.status ? `<i class="${x.status}"></i>` : ""}${esc(x.label)}</label>`).join("")}</div>
<div class="panel grid" id="p-all">${results.map((r) => card(r)).join("")}</div>
${results.map((r) => `<div class="panel one" id="p-${r.state}">${card(r, true)}</div>`).join("")}
<p class="foot">${t.made}</p>
</div></body></html>`;
writeFileSync(join(out, "states.html"), html);
writeFileSync(join(out, "states.json"), JSON.stringify({ url: server ? null : url, select: sel, api: patterns, date: new Date().toISOString(), results }, null, 2));
writeFileSync(join(out, "states.md"), [`# ${t.title}: ${site} · \`${sel}\``, ``, `${problems} / ${results.length} ${o.lang === "pt" ? "estados com problema" : "states with problems"}. API: ${patterns.join(", ") || "-"}`, ``, ...results.map((r) => `- **${t.st[r.state][0]}**: ${t[r.status]}${r.issues.length ? ". " + r.issues.join("; ") : ""}${r.notes.length ? ` (${r.notes.join("; ")})` : ""}`)].join("\n"));
const b2 = await launch();
const pv = await b2.newPage({ viewport: { width: 1480, height: 900 } });
await pv.goto(pathToFileURL(join(out, "states.html")).href, { waitUntil: "load" });
await pv.screenshot({ path: join(out, "states.png"), fullPage: true });
await b2.close();
console.log(`\n${problems} of ${results.length} states with problems`);
console.log(`ok ${join(out, "states.html")}`);
