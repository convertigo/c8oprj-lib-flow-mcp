#!/usr/bin/env node
// c8o: command line for a Convertigo Flow project edited as files on disk (prototype).
// A thin client of the Flow MCP endpoint in sources mode: each command is a tools/call (plus a cached tool list for
// generic tools), printed as plain text. No dependency: Node 18+ (global fetch).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { tmpdir, homedir, userInfo } from "node:os";
import { join } from "node:path";

const VERSION = "0.3.0";
const USAGE = `c8o ${VERSION}: edit the project files, then check, sync, run and view them.

  c8o check [path...]          validate the changed files (or the given ones) without saving them
  c8o sync [path...]           validate and save them; --gateway also creates the EntityGateway of the data model
  c8o run <flow> [k=v...]      run a Flow; k:=<json> for a typed value, --input '<json>' for the whole input
                               (k=v wins over --input); the result is printed as JSON on stdout, notes on stderr
  c8o view [k=v...]            build the frontend (dev.sync) and print the viewer URL on the first line; a stopped
                               viewer is started first (dev.ensure)
  c8o block <ns.name>          contract of a block (library or project)
  c8o guide [path|uri]         a guide as the engine serves it (default: start, with the tree of guides; aliases
                               and flow://lib/... resolved); the plain files are in /c8o/guide
  c8o tools [word]             list the engine tools
  c8o skill [--install <dir>]  the skill of this command, as this engine serves it; --install writes
                               <dir>/convertigo-flow-cli/SKILL.md (a skills folder: ~/.codex/skills, ~/.claude/skills...)
  c8o help <tool>              arguments of a tool
  c8o <tool> [k=v | k:=json]   call any tool of c8o tools; the project is added when the tool takes one

Options: --json (the whole result as JSON), --project <name>, -- (end of options).
Exit code: 0 ok, 1 refused, pending or failed, 2 usage, connection or protocol error.
In a pipe the shell reports the last command: use set -o pipefail to keep c8o's status.
Paths are project-relative: _flow/flows/<Flow>.flow.js, _flow/blocks/<ns>/<name>.block.js, _flow/data/model.yaml,
.flow.svelte and .flow.css under _flow/frontbuilder/svelte/model/<App>/src/.`;

// Options and key=value arguments each command accepts (positional: number allowed).
const COMMANDS = {
  check: { pos: Infinity, flags: ["gateway"], kv: false },
  sync: { pos: Infinity, flags: ["gateway"], kv: false },
  run: { pos: 1, min: 1, flags: ["input"], kv: true },
  view: { pos: 0, flags: [], kv: true },
  block: { pos: 1, min: 1, flags: [], kv: false },
  guide: { pos: 1, flags: [], kv: false },
  tools: { pos: 1, flags: [], kv: false },
  skill: { pos: 0, flags: ["install"], kv: false },
  help: { pos: 1, flags: [], kv: false },
};
const GENERIC = { pos: 0, flags: ["args"], kv: true };

class Usage extends Error {}
class Protocol extends Error {}

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

function parseArgs(argv, spec) {
  const pos = [], kv = {}, flags = {};
  let rest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!rest && a === "--") { rest = true; continue; }
    if (!rest && a.startsWith("--")) {
      const name = a.slice(2);
      if (name === "json" || (name === "gateway" && spec.flags.includes("gateway"))) { flags[name] = true; continue; }
      if (name === "project" || spec.flags.includes(name)) {
        if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) throw new Usage(a + " needs a value");
        flags[name] = argv[++i];
        continue;
      }
      throw new Usage("Unknown option " + a + ". See c8o help.");
    }
    const m = !rest && /^([A-Za-z_][\w.-]*)(:?=)([\s\S]*)$/.exec(a);
    if (m) {
      if (!spec.kv) throw new Usage(`${m[1]}${m[2]}… is not an argument of this command. See c8o help.`);
      if (m[2] === ":=") {
        try { kv[m[1]] = JSON.parse(m[3]); } catch { throw new Usage(`${m[1]}:= needs JSON, got: ${m[3]}`); }
      } else kv[m[1]] = m[3];
      continue;
    }
    pos.push(a);
  }
  if (pos.length > spec.pos) throw new Usage(`Too many arguments: ${pos.slice(spec.pos).join(" ")}. See c8o help.`);
  if (pos.length < (spec.min || 0)) throw new Usage("Missing argument. See c8o help.");
  for (const k of ["input", "args"]) {
    if (flags[k] === undefined) continue;
    try { flags[k] = JSON.parse(flags[k]); } catch { throw new Usage(`--${k} needs JSON`); }
    if (!flags[k] || typeof flags[k] !== "object" || Array.isArray(flags[k])) throw new Usage(`--${k} needs a JSON object`);
  }
  return { pos, kv, flags };
}

let rpcId = 0;
async function rpc(cfg, method, params) {
  const url = new URL(cfg.url);
  url.searchParams.set("jsonOnly", "true");
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    "X-Convertigo-Source-Mode": "sources", "X-Convertigo-No-Log": "true" };
  if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
  const id = ++rpcId;
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, redirect: "error",
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal: AbortSignal.timeout(900_000) });
  } catch (e) {
    throw new Protocol("Cannot reach the engine (" + (e.cause?.code || e.name) + ").");
  }
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {
    for (const line of text.split(/\r?\n/)) if (line.startsWith("data:")) { try { data = JSON.parse(line.slice(5)); } catch { /* next */ } }
  }
  const valid = data && data.jsonrpc === "2.0" && (("result" in data) !== ("error" in data))
    && ("result" in data ? res.ok && data.id === id : data.id === id || data.id === null);
  if (!valid) throw new Protocol(`No JSON-RPC answer from the engine (HTTP ${res.status}).`);
  return data;
}

// The tools: the default list and the ones behind tools-more, cached per endpoint, project and identity.
function cachePath(cfg) {
  const key = createHash("sha256").update([cfg.url, cfg.project, cfg.token].join("\n")).digest("hex").slice(0, 16);
  const dir = join(tmpdir(), "c8o-" + userInfo().uid);
  return { dir, file: join(dir, "tools-" + key + ".json") };
}

async function tools(cfg, fresh) {
  const { dir, file } = cachePath(cfg);
  if (!fresh) {
    try {
      const st = statSync(dir);
      if (st.uid !== userInfo().uid || (st.mode & 0o077)) throw new Error("cache folder not private");
      const c = JSON.parse(readFileSync(file, "utf8"));
      if (Date.now() - c.at < 600_000 && Array.isArray(c.tools)) return c.tools;
    } catch { /* refresh */ }
  }
  const core = await rpc(cfg, "tools/list", {});
  if (core.error || !Array.isArray(core.result?.tools)) throw new Protocol("tools/list failed: " + (core.error?.message || "no list"));
  const list = core.result.tools.filter(t => t.name !== "tools-more").map(t => ({ name: t.name, description: t.description || "",
    inputSchema: t.inputSchema }));
  if (core.result.tools.some(t => t.name === "tools-more")) {
    const more = await call(cfg, "tools-more", {});
    const extra = more.result?.structuredContent?.tools;
    if (failed(more) || !Array.isArray(extra)) throw new Protocol("tools-more failed: " + (texts(more).join(" ") || "no list"));
    for (const t of extra) {
      const name = typeof t === "string" ? t : t?.name;
      if (name && !list.some(x => x.name === name)) list.push({ name, description: (typeof t === "object" && t.description) || "", more: true });
    }
  }
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const st = statSync(dir);
    if (st.uid !== userInfo().uid || (st.mode & 0o077)) throw new Error("cache folder not private");
    const tmp = file + "." + process.pid;
    writeFileSync(tmp, JSON.stringify({ at: Date.now(), tools: list }), { mode: 0o600 });
    renameSync(tmp, file);
  } catch { /* no cache */ }
  return list;
}

async function findTool(cfg, name) {
  return (await tools(cfg)).find(t => t.name === name) || (await tools(cfg, true)).find(t => t.name === name);
}

async function call(cfg, name, args) {
  return rpc(cfg, "tools/call", { name, arguments: args });
}

// --- rendering -------------------------------------------------------------------------------------------------------

const NOISE = [/\s*keys: [^\n]*?Use structuredContent for data\.?/g, /\s*See structuredContent(\.[\w.]+)?\.?/g,
  /\s*Use structuredContent for data\.?/g];
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

function show(v) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function structured(data, printed) {
  const sc = data?.result?.structuredContent;
  if (!sc || typeof sc !== "object") return "";
  const rest = {}, blocks = [];
  const shown = printed.join("\n");
  for (const [k, v] of Object.entries(sc)) {
    if (k === "ok" && v === true) continue;
    if (k === "unsavedSources" && v && v.count === 0) continue;
    if (typeof v === "string" && v.length > 20 && shown.includes(v)) continue;   // already in the text
    if (k === "error" && v && typeof v === "object" && printed.length) {          // the text says the message
      const { message, code, hint, ...more } = v;
      if (Object.keys(more).length) rest.error = more;
      continue;
    }
    if (typeof v === "string" && v.includes("\n") && v.length > 80) blocks.push(`--- ${k} ---\n${v.replace(/\n$/, "")}`);
    else rest[k] = v;
  }
  return [Object.keys(rest).length ? JSON.stringify(rest, null, 2) : "", ...blocks].filter(Boolean).join("\n");
}

function generic(data) {
  const t = texts(data);
  return [...t, structured(data, t)].filter(Boolean).join("\n");
}

// The diagnostics of an error, where the server puts them (mcp.js errorDiagnosticLines).
function errorOf(response) {
  const sc = response?.result?.structuredContent;
  return (sc && typeof sc.error === "object" && sc.error) || (response?.error && typeof response.error === "object" ? response.error : null);
}
function diagnostics(response) {
  const sc = response?.result?.structuredContent || {};
  const error = errorOf(response) || {}, details = error.details;
  const list = Array.isArray(error.diagnostics) ? error.diagnostics : Array.isArray(details) ? details
    : details && Array.isArray(details.diagnostics) ? details.diagnostics : Array.isArray(sc.diagnostics) ? sc.diagnostics : [];
  return list.filter(d => d && typeof d === "object");
}

function diagnosticLines(path, d) {
  const where = [d.block && d.block + (d.property ? "." + d.property : ""), typeof d.path === "string" ? d.path : ""].filter(Boolean).join(", ");
  const out = [`${path}${d.line ? ":" + d.line + (d.column ? ":" + d.column : "") : ""}: ${d.severity || "error"}${d.code ? " " + d.code : ""}${where ? " (" + where + ")" : ""}: ${d.message || ""}`];
  if (d.expression && !String(d.message || "").includes(d.expression)) out.push(`  expression: ${d.expression}`);
  for (const k of ["expected", "candidates", "allowed"]) if (d[k] !== undefined) out.push(`  ${k}: ${show(d[k])}`);
  if (d.hint) out.push(`  fix: ${d.hint}`);
  if (d.proposedPatch) out.push(`  proposed patch: ${show(d.proposedPatch)}`);
  return out;
}

const PENDING = /changed on disk during the sync/i;

function renderSync(data, dry) {
  const sc = data?.result?.structuredContent;
  if (!sc || !Array.isArray(sc.results)) return { text: generic(data), bad: failed(data) };
  const out = [];
  let bad = false;
  for (const e of sc.results) {
    const refused = failed(e.response), pending = !refused && PENDING.test(e.note || "");
    bad = bad || refused || pending;
    const state = refused ? "REFUSED" : pending ? "PENDING (changed on disk during the sync: sync it again)"
      : dry ? "valid" : e.applied ? (e.rewritten ? "saved, normalized by the engine: read it again" : "saved") : "checked";
    out.push(`${e.path}: ${state}${e.type ? " (" + e.type + ")" : ""}`);
    const ds = diagnostics(e.response);
    for (const d of ds) out.push(...diagnosticLines(e.path, d));
    const error = errorOf(e.response) || {};
    if (refused) {
      if (!ds.length) texts(e.response).forEach(t => out.push("  " + t.replace(/\n/g, "\n  ")));
      else {
        if (error.hint && !ds.some(d => d.hint === error.hint)) out.push("  fix: " + error.hint);
        const patch = error.proposedPatch || (error.details && !Array.isArray(error.details) && error.details.proposedPatch);
        if (patch && !ds.some(d => d.proposedPatch)) out.push("  proposed patch: " + show(patch));
        const fields = error.details && !Array.isArray(error.details) && (error.details.errors || error.details.fields);
        if (fields) out.push("  fields: " + show(fields));
      }
      out.push(e.type === "flow" ? "  not saved: c8o run reads this file from disk, HTTP keeps the last synced version."
        : "  not saved: the engine keeps the last synced version.");
    } else {
      // warnings and notes of the validator or the writer, never lost: the text minus the plain OK line
      const seen = new Set(ds.map(d => d.message));
      for (const t of texts(e.response)) {
        const s = t.replace(/^OK\.(\s+[\w.-]+\.)?\s*/, "").trim();
        if (s && !seen.has(s)) out.push("  " + s.replace(/\n/g, "\n  "));
      }
      const w = e.response?.result?.structuredContent?.warnings;
      if (Array.isArray(w)) for (const x of w) {
        const s = typeof x === "string" ? x : x.message || JSON.stringify(x);
        if (!out.some(l => l.includes(s))) out.push("  warning: " + s);
      }
      if (e.note && !e.rewritten && !pending) out.push("  note: " + e.note);
    }
  }
  const s = sc.summary || {};
  if (!sc.results.length) out.push("No changed source since the last sync.");
  else out.push(`${s.checked || 0} checked, ${dry ? "dry run, nothing saved" : (s.applied || 0) + " saved"}, ${s.refused || 0} refused${s.rewritten ? ", " + s.rewritten + " normalized" : ""}.`);
  return { text: out.join("\n"), bad };
}

// --- output ----------------------------------------------------------------------------------------------------------

let secret = "";
function emit(stream, text) {
  if (!text) return;
  if (secret) text = text.split(secret).join("<token>");
  stream.write(text.endsWith("\n") ? text : text + "\n");
}
for (const s of [process.stdout, process.stderr]) s.on("error", e => { if (e.code === "EPIPE") process.exit(process.exitCode || 0); });

// --- commands --------------------------------------------------------------------------------------------------------

function project(cfg, flags) {
  const p = flags.project || cfg.project;
  if (!p) throw new Usage("No project: add --project <name> or set C8O_PROJECT.");
  return p;
}

function guideUri(arg) {
  if (!arg) return "flow://guide/start";
  if (/^[a-z]+:\/\//.test(arg)) return arg;
  return "flow://guide/" + arg.replace(/^.*\/guide\//, "").replace(/^\/+/, "").replace(/\.md$/, "");
}

function schemaLines(t, schema) {
  const req = new Set(schema?.required || []);
  const out = [`${t.name}: ${t.description || ""}`];
  for (const [k, p] of Object.entries(schema?.properties || {}))
    out.push(`  ${k} (${p.type || "any"}${req.has(k) ? ", required" : ""})${p.description ? ": " + p.description : ""}`);
  return out.join("\n");
}

function findSchema(v, depth = 0) {
  if (!v || typeof v !== "object" || depth > 4) return null;
  if (v.inputSchema && typeof v.inputSchema === "object") return v.inputSchema;
  if (v.type === "object" && v.properties) return v;
  for (const x of Object.values(v)) { const s = findSchema(x, depth + 1); if (s) return s; }
  return null;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || (cmd === "help" && !rest.length)) { emit(process.stdout, USAGE); return 0; }
  if (cmd === "--version" || cmd === "version") { emit(process.stdout, VERSION); return 0; }
  const { pos, kv, flags } = parseArgs(rest, COMMANDS[cmd] || GENERIC);
  const cfg = config();
  secret = cfg.token;
  const json = data => emit(process.stdout, JSON.stringify(data?.result ?? data, null, 2));
  switch (cmd) {
    case "check":
    case "sync": {
      const args = { project: project(cfg, flags), dryRun: cmd === "check" };
      if (pos.length) args.paths = pos.map(p => p.replace(/^\.\//, "").replace(/^\/project\//, ""));
      if (flags.gateway) args.gateway = true;
      const data = await call(cfg, "flow-source-sync", args);
      const r = renderSync(data, cmd === "check");
      if (flags.json) json(data); else emit(process.stdout, r.text);
      return r.bad || failed(data) ? 1 : 0;
    }
    case "run": {
      const input = Object.assign({}, flags.input || {}, kv);
      const data = await call(cfg, "code-run", { project: project(cfg, flags), name: pos[0], input });
      if (flags.json) { json(data); return failed(data) ? 1 : 0; }
      const sc = data?.result?.structuredContent;
      if (failed(data) || !sc) { emit(process.stderr, generic(data)); return failed(data) ? 1 : 0; }
      emit(process.stdout, JSON.stringify("result" in sc ? sc.result : null, null, 2));
      const notes = Object.entries(sc).filter(([k, v]) => !["ok", "result", "qname", "revision", "next"].includes(k)
        && !(k === "unsavedSources" && v && v.count === 0)).map(([k, v]) => `${k}: ${show(v)}`);
      emit(process.stderr, notes.join("\n"));
      return 0;
    }
    case "view": {
      const args = { actionId: "dev.sync", ...kv, project: project(cfg, flags) };
      let data = await call(cfg, "frontend-svelte-action", args);
      const stopped = d => !failed(d) && !d?.result?.structuredContent?.openUrl && d?.result?.structuredContent?.status === "stopped";
      if (args.actionId === "dev.sync" && stopped(data)) {
        // the viewer stops after 2 min without a page open (i195): start it, then sync, as its answer says
        const ensure = await call(cfg, "frontend-svelte-action", { actionId: "dev.ensure", wait: true, project: args.project });
        if (failed(ensure)) { emit(process.stderr, generic(ensure)); return 1; }
        emit(process.stderr, "c8o: the viewer was stopped; started it (dev.ensure), then dev.sync.");
        data = await call(cfg, "frontend-svelte-action", args);
      }
      if (flags.json) { json(data); return failed(data) || !data?.result?.structuredContent?.openUrl ? 1 : 0; }
      const sc = data?.result?.structuredContent || {};
      if (failed(data) || !sc.openUrl) { emit(process.stderr, generic(data) || "No viewer URL."); return 1; }
      const extra = Object.fromEntries(Object.entries(sc).filter(([k]) => !["ok", "openUrl"].includes(k)));
      emit(process.stdout, [sc.openUrl, Object.keys(extra).length ? JSON.stringify(extra, null, 2) : ""].filter(Boolean).join("\n"));
      return 0;
    }
    case "block": {
      const data = await call(cfg, "flow-block-get", { project: project(cfg, flags), name: pos[0] });
      if (flags.json) json(data); else emit(failed(data) ? process.stderr : process.stdout, generic(data));
      return failed(data) ? 1 : 0;
    }
    case "guide": {
      const data = await call(cfg, "flow-resource-get", { uri: guideUri(pos[0]), format: "text" });
      if (flags.json) json(data);
      else if (failed(data)) emit(process.stderr, texts(data).join("\n"));
      else emit(process.stdout, (data.result?.content || []).filter(c => c.type === "text").map(c => c.text).join("\n\n"));
      return failed(data) ? 1 : 0;
    }
    case "skill": {
      const data = await call(cfg, "flow-resource-get", { uri: "flow://skills/convertigo-flow-cli/SKILL", format: "text" });
      if (failed(data)) { emit(process.stderr, texts(data).join("\n")); return 1; }
      let text = (data.result?.content || []).filter(c => c.type === "text").map(c => c.text).join("\n\n");
      if (!/^---\r?\nname: convertigo-flow-cli\r?\n/.test(text)) throw new Protocol("The engine serves no convertigo-flow-cli skill.");
      if (!text.endsWith("\n")) text += "\n";
      if (!flags.install) { emit(process.stdout, text); return 0; }
      const dir = join(flags.install, "convertigo-flow-cli");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), text);
      emit(process.stdout, join(dir, "SKILL.md"));
      return 0;
    }
    case "tools": {
      const word = (pos[0] || "").toLowerCase();
      const lines = (await tools(cfg)).map(t => `${t.name}: ${String(t.description || "").split(/(?<=\.)\s/)[0]}`)
        .filter(l => !word || l.toLowerCase().includes(word));
      if (flags.json) json((await tools(cfg)).filter(t => !word || (t.name + " " + t.description).toLowerCase().includes(word)));
      else emit(process.stdout, lines.join("\n"));
      return 0;
    }
    case "help": {
      const t = await findTool(cfg, pos[0]);
      if (!t) throw new Usage(`Unknown tool ${pos[0]}: see c8o tools.`);
      let schema = t.inputSchema;
      if (!schema && t.more) schema = findSchema((await call(cfg, "tools-more", { name: t.name })).result?.structuredContent);
      if (flags.json) json({ name: t.name, description: t.description, inputSchema: schema || null });
      else emit(process.stdout, schemaLines(t, schema));
      return 0;
    }
    default: {
      const t = await findTool(cfg, cmd);
      if (!t) throw new Usage(`Unknown command or tool: ${cmd}. See c8o help and c8o tools.`);
      const args = Object.assign({}, flags.args || {}, kv);
      let schema = t.inputSchema;
      if (!schema && t.more) schema = findSchema((await call(cfg, "tools-more", { name: t.name })).result?.structuredContent);
      if (schema?.properties?.project && args.project === undefined && (flags.project || cfg.project)) args.project = project(cfg, flags);
      const data = t.more ? await call(cfg, "tools-more", { name: t.name, arguments: args }) : await call(cfg, cmd, args);
      if (flags.json) json(data); else emit(failed(data) ? process.stderr : process.stdout, generic(data));
      return failed(data) ? 1 : 0;
    }
  }
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => {
  emit(process.stderr, "c8o: " + (e?.message || e));
  process.exitCode = 2;
});
