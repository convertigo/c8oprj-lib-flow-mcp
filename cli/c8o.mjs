#!/usr/bin/env node
// c8o: command line for a Convertigo Flow project edited as files on disk (prototype).
// A thin client of the Flow MCP endpoint in sources mode: each command is one tools/call, printed as plain text.
// No dependency: Node 18+ (global fetch).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

const VERSION = "0.1.0";
const USAGE = `c8o ${VERSION}: edit the project files, then check, sync, run and view them.

  c8o check [path...]          validate changed files (or the given ones) without saving
  c8o sync [path...]           validate and save them (--gateway: also the EntityGateway of the model)
  c8o run <flow> [k=v...]      run a Flow; k:=<json> for a typed value, --input '<json>' for the whole input
  c8o view                     build the frontend and print the viewer URL (dev.sync)
  c8o block <ns.name>          contract of a block (library or project)
  c8o guide [path|uri]         print a guide (default: start); files: see the guide folder of your setup
  c8o tools [word]             list the engine tools
  c8o help <tool>              arguments of a tool
  c8o <tool> [k=v | k:=json]   call any listed tool; the project is added when the tool takes one

Options: --json (raw structured result), --project <name>.
Exit code: 0 ok, 1 refused or failed, 2 usage or connection error.
Paths are project-relative: _flow/flows/<Flow>.flow.js, _flow/blocks/<ns>/<name>.block.js, ...`;

class Usage extends Error {}

function config() {
  const files = [process.env.C8O_CONFIG, "/c8o/c8o.json", join(homedir(), ".c8o.json")].filter(Boolean);
  let cfg = {};
  for (const f of files) {
    try { cfg = JSON.parse(readFileSync(f, "utf8")); break; } catch { /* next */ }
  }
  const url = process.env.C8O_URL || cfg.url;
  if (!url) throw new Usage("No endpoint: set C8O_URL or write /c8o/c8o.json {\"url\":..., \"project\":...}.");
  let token = "";
  const tokenFile = process.env.C8O_TOKEN_FILE || cfg.tokenFile;
  if (tokenFile) token = readFileSync(tokenFile, "utf8").trim();
  return { url, project: process.env.C8O_PROJECT || cfg.project || "", token };
}

function parseArgs(argv) {
  const pos = [], kv = {}, flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json" || a === "--gateway") flags[a.slice(2)] = true;
    else if (a === "--project" || a === "--input" || a === "--args") {
      if (i + 1 >= argv.length) throw new Usage(a + " needs a value");
      flags[a.slice(2)] = argv[++i];
    } else if (/^[A-Za-z_][\w.-]*:=/.test(a)) {
      const k = a.slice(0, a.indexOf(":=")), v = a.slice(a.indexOf(":=") + 2);
      try { kv[k] = JSON.parse(v); } catch { throw new Usage(`${k}:= needs JSON, got: ${v}`); }
    } else if (/^[A-Za-z_][\w.-]*=/.test(a)) kv[a.slice(0, a.indexOf("="))] = a.slice(a.indexOf("=") + 1);
    else pos.push(a);
  }
  for (const k of ["input", "args"]) {
    if (flags[k] === undefined) continue;
    try { flags[k] = JSON.parse(flags[k]); } catch { throw new Usage(`--${k} needs JSON`); }
    if (!flags[k] || typeof flags[k] !== "object" || Array.isArray(flags[k])) throw new Usage(`--${k} needs a JSON object`);
  }
  return { pos, kv, flags };
}

let rpcId = 0;
async function rpc(cfg, method, params) {
  const url = cfg.url + (cfg.url.includes("?") ? "&" : "?") + "jsonOnly=true";
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    "X-Convertigo-Source-Mode": "sources" };
  if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
  let res;
  try {
    res = await fetch(url, { method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }), signal: AbortSignal.timeout(900_000) });
  } catch (e) {
    throw new Usage("Cannot reach the engine (" + (e.cause?.code || e.name) + ").");
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {
    for (const line of text.split(/\r?\n/)) if (line.startsWith("data:")) { try { data = JSON.parse(line.slice(5)); } catch { /* next */ } }
  }
  if (!data) throw new Usage(`No JSON-RPC answer (HTTP ${res.status}).`);
  return data;
}

async function tools(cfg) {
  const cache = join(tmpdir(), "c8o-tools-" + createHash("sha1").update(cfg.url).digest("hex").slice(0, 12) + ".json");
  try {
    const c = JSON.parse(readFileSync(cache, "utf8"));
    if (Date.now() - c.at < 300_000) return c.tools;
  } catch { /* refresh */ }
  const data = await rpc(cfg, "tools/list", {});
  const list = data.result?.tools || [];
  try { mkdirSync(tmpdir(), { recursive: true }); writeFileSync(cache, JSON.stringify({ at: Date.now(), tools: list }), { mode: 0o600 }); } catch { /* no cache */ }
  return list;
}

async function call(cfg, name, args) {
  return rpc(cfg, "tools/call", { name, arguments: args });
}

// --- rendering -------------------------------------------------------------------------------------------------------

const NOISE = [/\s*keys: [^\n]*?Use structuredContent for data\.?/g, /\s*See structuredContent(\.[\w.]+)?\.?/g];
function clean(t) {
  let s = String(t || "");
  for (const r of NOISE) s = s.replace(r, "");
  s = s.trim();
  return /^OK\.?$/.test(s) ? "" : s;
}

function failed(data) {
  const r = data?.result;
  return !!(data?.error || r?.isError === true || r?.structuredContent?.ok === false);
}

function texts(data) {
  if (data?.error) return [clean(data.error.message || JSON.stringify(data.error))];
  return (data?.result?.content || []).filter(c => c.type === "text").map(c => clean(c.text)).filter(Boolean);
}

function structured(data, printed) {
  const sc = data?.result?.structuredContent;
  if (!sc || typeof sc !== "object") return "";
  const rest = {}, blocks = [];
  const shown = printed.join("\n");
  for (const [k, v] of Object.entries(sc)) {
    if (k === "ok" && v === true) continue;
    if (typeof v === "string" && v.length > 20 && shown.includes(v)) continue;   // already in the text
    if (k === "error" && failed(data) && printed.length) continue;              // the text says it
    if (typeof v === "string" && v.includes("\n") && v.length > 80) blocks.push(`--- ${k} ---\n${v.replace(/\n$/, "")}`);
    else rest[k] = v;
  }
  const out = [];
  if (Object.keys(rest).length) out.push(JSON.stringify(rest, null, 2));
  return out.concat(blocks).join("\n");
}

function generic(data) {
  const t = texts(data);
  const s = structured(data, t);
  return [...t, s].filter(Boolean).join("\n");
}

function diagnostics(response) {
  const found = [];
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || depth > 6) return;
    if (Array.isArray(v)) { v.forEach(x => walk(x, depth + 1)); return; }
    if (Array.isArray(v.diagnostics)) v.diagnostics.forEach(d => d && typeof d === "object" && found.push(d));
    for (const [k, x] of Object.entries(v)) if (k !== "diagnostics") walk(x, depth + 1);
  };
  walk(response?.result?.structuredContent, 0);
  return found;
}

function renderSync(data, dry) {
  const sc = data?.result?.structuredContent;
  if (!sc || !Array.isArray(sc.results)) return generic(data);
  const out = [];
  for (const e of sc.results) {
    const bad = failed(e.response);
    const state = bad ? "REFUSED" : dry ? "valid" : e.applied ? (e.rewritten ? "saved, normalized by the engine: read it again" : "saved") : "checked";
    out.push(`${e.path}: ${state}${e.type ? " (" + e.type + ")" : ""}`);
    const ds = diagnostics(e.response);
    for (const d of ds) {
      const where = [d.block, d.property].filter(Boolean).join(".");
      out.push(`${e.path}${d.line ? ":" + d.line : ""}: ${d.severity || "error"} ${d.code || ""}${where ? " (" + where + ")" : ""}: ${d.message || ""}`.replace(/\s+:/, ":"));
      if (d.expression) out.push(`  expression: ${d.expression}`);
      if (d.hint) out.push(`  fix: ${d.hint}`);
      if (d.proposedPatch) out.push(`  proposed: ${typeof d.proposedPatch === "string" ? d.proposedPatch : JSON.stringify(d.proposedPatch)}`);
    }
    if (bad && !ds.length) texts(e.response).forEach(t => out.push("  " + t.replace(/\n/g, "\n  ")));
    const w = e.response?.result?.structuredContent?.warnings;
    if (Array.isArray(w)) w.forEach(x => out.push("  warning: " + (typeof x === "string" ? x : x.message || JSON.stringify(x))));
    if (e.note && !bad && !e.rewritten) out.push("  note: " + e.note);  // a rewritten file already says: read it again
    if (bad) out.push("  not saved: c8o run reads this file from disk, HTTP keeps the last synced version.");
  }
  const s = sc.summary || {};
  if (!sc.results.length) out.push("No changed source since the last sync.");
  else out.push(`${s.checked || 0} checked, ${dry ? "dry run, nothing saved" : (s.applied || 0) + " saved"}, ${s.refused || 0} refused${s.rewritten ? ", " + s.rewritten + " normalized" : ""}.`);
  return out.join("\n");
}

function renderRun(data) {
  const sc = data?.result?.structuredContent;
  if (failed(data) || !sc) return generic(data);
  const out = [];
  if ("result" in sc) out.push(JSON.stringify(sc.result, null, 2));
  for (const [k, v] of Object.entries(sc)) {
    if (["ok", "result", "qname", "revision", "next"].includes(k)) continue;
    out.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  }
  return out.join("\n");
}

function renderView(data) {
  const sc = data?.result?.structuredContent || {};
  if (failed(data)) return generic(data);
  const out = [];
  if (sc.openUrl) out.push(sc.openUrl);
  const rest = Object.fromEntries(Object.entries(sc).filter(([k]) => !["ok", "openUrl"].includes(k)));
  if (Object.keys(rest).length) out.push(JSON.stringify(rest, null, 2));
  return out.join("\n") || generic(data);
}

// --- commands --------------------------------------------------------------------------------------------------------

function project(cfg, flags) {
  const p = flags.project || cfg.project;
  if (!p) throw new Usage("No project: add --project <name> or set C8O_PROJECT.");
  return p;
}

function guideUri(arg) {
  if (!arg) return "flow://guide/start";
  if (/^[a-z]+:\/\//.test(arg)) return arg;
  const path = arg.replace(/^.*\/guide\//, "").replace(/^\/+/, "").replace(/\.md$/, "");
  return "flow://guide/" + path;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || (cmd === "help" && !rest.length)) { console.log(USAGE); return 0; }
  if (cmd === "--version" || cmd === "version") { console.log(VERSION); return 0; }
  const { pos, kv, flags } = parseArgs(rest);
  const cfg = config();
  const print = (data, render) => {
    console.log(flags.json ? JSON.stringify(data?.result?.structuredContent ?? data?.result ?? data?.error ?? data, null, 2) : render(data));
    return failed(data) ? 1 : 0;
  };
  switch (cmd) {
    case "check":
    case "sync": {
      const args = { project: project(cfg, flags), dryRun: cmd === "check" };
      if (pos.length) args.paths = pos.map(p => p.replace(/^\.\//, "").replace(/^\/project\//, ""));
      if (flags.gateway) args.gateway = true;
      return print(await call(cfg, "flow-source-sync", args), d => renderSync(d, cmd === "check"));
    }
    case "run": {
      if (!pos[0]) throw new Usage("c8o run <flow> [k=v...] [--input '<json>']");
      const input = Object.assign({}, flags.input || {}, kv);
      return print(await call(cfg, "code-run", { project: project(cfg, flags), name: pos[0], input }), renderRun);
    }
    case "view":
      return print(await call(cfg, "frontend-svelte-action", { project: project(cfg, flags), actionId: kv.actionId || "dev.sync" }), renderView);
    case "block":
      if (!pos[0]) throw new Usage("c8o block <ns.name>");
      return print(await call(cfg, "flow-block-get", { project: project(cfg, flags), name: pos[0] }), generic);
    case "guide": {
      const data = await call(cfg, "flow-resource-get", { uri: guideUri(pos[0]), format: "text" });
      console.log(texts(data).join("\n\n"));
      return failed(data) ? 1 : 0;
    }
    case "tools": {
      const list = await tools(cfg);
      const word = (pos[0] || "").toLowerCase();
      for (const t of list) {
        const first = String(t.description || "").split(/(?<=\.)\s/)[0];
        if (!word || (t.name + " " + first).toLowerCase().includes(word)) console.log(`${t.name}: ${first}`);
      }
      return 0;
    }
    case "help": {
      const t = (await tools(cfg)).find(x => x.name === pos[0]);
      if (!t) throw new Usage(`Unknown tool ${pos[0]}: see c8o tools.`);
      const schema = t.inputSchema || {}, req = new Set(schema.required || []);
      console.log(`${t.name}: ${t.description || ""}`);
      for (const [k, p] of Object.entries(schema.properties || {}))
        console.log(`  ${k} (${p.type || "any"}${req.has(k) ? ", required" : ""})${p.description ? ": " + p.description : ""}`);
      return 0;
    }
    default: {
      const t = (await tools(cfg)).find(x => x.name === cmd);
      if (!t) throw new Usage(`Unknown command or tool: ${cmd}. See c8o help and c8o tools.`);
      const args = Object.assign({}, flags.args || {}, kv);
      if (t.inputSchema?.properties?.project && args.project === undefined && (flags.project || cfg.project)) args.project = project(cfg, flags);
      return print(await call(cfg, cmd, args), generic);
    }
  }
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => {
  if (e instanceof Usage) { console.error("c8o: " + e.message); process.exitCode = 2; }
  else { console.error("c8o: " + (e?.message || e)); process.exitCode = 2; }
});
