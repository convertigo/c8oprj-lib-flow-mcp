#!/usr/bin/env node
// c8o: command line for a Convertigo Flow project edited as files on disk (prototype).
// A thin client of the Flow MCP endpoint in sources mode: each command is a tools/call (plus a cached tool list for
// generic tools), printed as plain text. No dependency: Node 18+ (global fetch).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { tmpdir, homedir, userInfo } from "node:os";
import { join } from "node:path";

const VERSION = "0.6.0";
const COMMON_OPTIONS = "Options: --json (the whole result as JSON), --project <name>, -- (end of options).";
const COMMAND_USAGE = `  c8o check [path...]          validate the changed files (or the given ones) without saving them
                               --gateway also checks the data model, if present
  c8o sync [path...]           validate and save them; --gateway also creates the EntityGateway of the data model
  c8o run <flow> [k=v...]      run a Flow in the engine, without a user session (a test run, private Flows too); k:=<json> for a typed value, --input '<json>' for the whole input
                               (k=v wins over --input); the whole result is printed as JSON on stdout (never shortened:
                               pipe it to node or jq), notes on stderr
  c8o call <flow> [k=v...]     call a Flow over HTTP as a browser does (POST .json), in a session kept between calls
                               (cookie jar): sign in with the app's own sign-in Flow first; --as <name> keeps several
                               sessions (a manager, a contributor); --end ends the session with this call
                               --anonymous skips sending and saving cookies and defaults to __removeSession=true:
                               with --json, setCookie: [] proves that no session stayed; nothing to set in the Flow
                               --json prints status, received cookie names (setCookie), and body on stdout, including
                               HTTP and application errors
                               k:=<json> for a typed value, --input '<json>' for the whole input (k=v wins)
  c8o session end|show         end the session (__removeSession, frees its licence session) or show its cookies' names
                               (--as <name> selects the session)
  c8o session demo [<account>] list the demo accounts of this server, or open a session of one without its password
                               (--as <name>), when the server provides them; never guess a password
  c8o session cookie           the session's cookies for the browser, as JSON for Playwright's addCookies (--as <name>,
                               --url <viewer URL> when the browser reaches the server at another address)
  c8o view [k=v...]            build the frontend (dev.sync) and print the viewer URL on the first line; a stopped
                               viewer is started first (dev.ensure)
  c8o block <ns.name>          contract of a block (library or project)
  c8o blocks [word]            list matching blocks; --namespace <ns> filters the catalog
  c8o guide [path|uri]         a guide as the engine serves it (default: start, with the tree of guides; aliases
                               and flow://lib/... resolved); the plain files are in /c8o/guide
  c8o tools [word]             list the engine tools
  c8o skill [--install <dir>]  the skill of this command, as this engine serves it; --install writes
                               <dir>/convertigo-flow-cli/SKILL.md (a skills folder: ~/.codex/skills, ~/.claude/skills...)
  c8o version                 print the CLI version (also available as --version)
  c8o help <command or tool>   usage of a local command or arguments of an engine tool
  c8o <tool> [k=v | k:=json]   call any tool of c8o tools; the project is added when the tool takes one`;
const USAGE = `c8o ${VERSION}: edit the project files, then check, sync, run and view them.

${COMMAND_USAGE}

${COMMON_OPTIONS}
Exit code: 0 ok, 1 refused, pending or failed, 2 usage, connection or protocol error.
In a pipe the shell reports the last command: use set -o pipefail to keep c8o's status.
Paths are project-relative: _flow/flows/<Flow>.flow.js, _flow/blocks/<ns>/<name>.block.js, _flow/data/model.yaml,
.flow.svelte and .flow.css under _flow/frontbuilder/svelte/model/<App>/src/.`;

// Options and key=value arguments each command accepts (positional: number allowed).
const COMMANDS = {
  check: { pos: Infinity, flags: ["gateway"], kv: false },
  sync: { pos: Infinity, flags: ["gateway"], kv: false },
  run: { pos: 1, min: 1, flags: ["input"], kv: true },
  call: { pos: 1, min: 1, flags: ["input", "as"], bool: ["end", "anonymous"], kv: true },
  session: { pos: 2, min: 1, flags: ["as", "url"], kv: false },
  view: { pos: 0, flags: [], kv: true },
  block: { pos: 1, min: 1, flags: [], kv: false },
  blocks: { pos: 1, flags: ["namespace"], kv: false },
  guide: { pos: 1, flags: [], kv: false },
  tools: { pos: 1, flags: [], kv: false },
  skill: { pos: 0, flags: ["install"], kv: false },
  version: { pos: 0, flags: [], kv: false },
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
  // the project's own HTTP endpoint (c8o call): configured, or next to the MCP endpoint (.../api/flow-mcp -> .../projects,
  // the bench relay's /flow -> /app)
  const app = process.env.C8O_APP_URL || cfg.app || (/\/api\/flow-mcp\/?$/.test(url) ? url.replace(/\/api\/flow-mcp\/?$/, "/projects")
    : /\/flow\/?$/.test(url) ? url.replace(/\/flow\/?$/, "/app") : "");
  // where the browser reaches the server (c8o session cookie): configured, or the app's own server
  const browser = process.env.C8O_BROWSER_URL || cfg.browser || (/\/projects\/?$/.test(app) ? app : "");
  return { url, app, browser, demo: cfg.demo || "", project: process.env.C8O_PROJECT || cfg.project || "", token };
}

function parseArgs(argv, spec) {
  const pos = [], kv = {}, flags = {};
  const plainKeys = new Set();
  let rest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!rest && a === "--") { rest = true; continue; }
    if (!rest && a.startsWith("--")) {
      const name = a.slice(2);
      if (name === "json" || (name === "gateway" && spec.flags.includes("gateway")) || (spec.bool || []).includes(name)) {
        flags[name] = true; continue;
      }
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
        plainKeys.delete(m[1]);
      } else {
        kv[m[1]] = m[3];
        plainKeys.add(m[1]);
      }
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
  return { pos, kv, flags, plainKeys };
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
  const lines = (data?.result?.content || []).filter(c => c.type === "text").map(c => clean(c.text)).filter(Boolean);
  const hint = data?.result?.structuredContent?.error?.hint;
  if (hint && !lines.join("\n").includes(hint)) lines.push(hint);
  return lines;
}

function show(v) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function structured(data, printed, indent = 2) {
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
  return [Object.keys(rest).length ? JSON.stringify(rest, null, indent) : "", ...blocks].filter(Boolean).join("\n");
}

function generic(data, indent) {
  const t = texts(data);
  return [...t, structured(data, t, indent)].filter(Boolean).join("\n");
}

function referenceCommands(projectName, providers) {
  const quote = value => /^[\w.-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'";
  return [...new Set(providers.map(provider => provider.project))].map(reference =>
    `c8o flow-project-reference project=${quote(projectName)} reference=${quote(reference)}`);
}

function workspaceBlockLines(providers, guides, commands) {
  return [
    ...providers.map(provider => `${provider.block}: provided by ${provider.project}`),
    ...commands,
    ...guides.map(uri => `Read ${uri}`),
  ];
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
      out.push(e.type === "flow" ? "  not saved: code-run (c8o run) reads the file from disk, c8o call and the pages keep the last synced version."
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

// --- sessions (c8o call) ---------------------------------------------------------------------------------------------

function privateDir() {
  const dir = join(tmpdir(), "c8o-" + userInfo().uid);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = statSync(dir);
  if (st.uid !== userInfo().uid || (st.mode & 0o077)) throw new Protocol("The folder " + dir + " is not private.");
  return dir;
}

function jarFile(cfg, name) {
  const key = createHash("sha256").update([cfg.app, cfg.project, name || "default"].join("\n")).digest("hex").slice(0, 16);
  return join(privateDir(), "session-" + key + ".json");
}

// { cookies: {name: value}, paths: {name: path} } (0.4: a plain {name: value} map)
function readJar(file) {
  let j = {};
  try { j = JSON.parse(readFileSync(file, "utf8")) || {}; } catch { /* no session */ }
  if (typeof j !== "object") j = {};
  return j.cookies && typeof j.cookies === "object" ? { cookies: j.cookies, paths: j.paths || {} } : { cookies: j, paths: {} };
}

function writeJar(file, jar) {
  const tmp = file + "." + process.pid;
  writeFileSync(tmp, JSON.stringify(jar), { mode: 0o600 });
  renameSync(tmp, file);
}

function demoUrl(cfg) {
  return process.env.C8O_DEMO_URL || cfg.demo || (/\/app\/?$/.test(cfg.app || "") ? cfg.app.replace(/\/app\/?$/, "/demo-session") : "");
}

async function appPost(cfg, file, form, target) {
  if (!cfg.app && !target) throw new Usage("No HTTP endpoint of the project: set C8O_APP_URL or \"app\" in /c8o/c8o.json.");
  const jar = file ? readJar(file) : null;
  const headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, */*" };
  const cookie = jar && Object.entries(jar.cookies).map(([k, v]) => k + "=" + v).join("; ");
  if (cookie) headers.Cookie = cookie;
  let res;
  try {
    res = await fetch(target || cfg.app.replace(/\/$/, "") + "/" + encodeURIComponent(project(cfg, {})) + "/.json",
      { method: "POST", headers, body: new URLSearchParams(form).toString(), redirect: "manual", signal: AbortSignal.timeout(900_000) });
  } catch (e) {
    throw new Protocol("Cannot reach the project endpoint (" + (e.cause?.code || e.name) + ").");
  }
  // Node 18 can expose a combined header. Split at cookie pairs, keeping Expires dates intact.
  const received = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") || "").split(/,(?=\s*[^=;,\s]+=)/);
  const setCookie = [];
  for (const c of received) {
    const [pair, ...attrs] = c.split(";");
    const at = pair.indexOf("=");
    if (at < 1) continue;
    const k = pair.slice(0, at).trim();
    if (!k) continue;
    setCookie.push(k);
    if (!jar) continue;
    const v = pair.slice(at + 1).trim();
    const gone = attrs.some(a => /^\s*max-age=0\s*$/i.test(a) || (/^\s*expires=/i.test(a) && Date.parse(a.split("=")[1]) < Date.now()));
    const path = attrs.map(a => /^\s*path=(.*)$/i.exec(a)).find(Boolean);
    if (gone || !v) { delete jar.cookies[k]; delete jar.paths[k]; }
    else { jar.cookies[k] = v; jar.paths[k] = path ? path[1].trim() || "/" : "/"; }
  }
  if (jar) writeJar(file, jar);
  return { status: res.status, setCookie, sentCookies: Boolean(cookie), text: await res.text() };
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
  return "flow://guide/" + arg.replace(/^.*\/guide\//, "").replace(/^\/+/, "").replace(/\.md$/, "");
}

function schemaLines(t, schema) {
  const req = new Set(schema?.required || []);
  const out = [`${t.name}: ${t.description || ""}`];
  for (const [k, p] of Object.entries(schema?.properties || {})) {
    const qualifiers = [p.type || "any"];
    if (req.has(k)) qualifiers.push("required");
    if (Object.hasOwn(p, "default")) qualifiers.push("default: " + JSON.stringify(p.default));
    out.push(`  ${k} (${qualifiers.join(", ")})${p.description ? ": " + p.description : ""}`);
  }
  return out.join("\n");
}

function findSchema(v, depth = 0) {
  if (!v || typeof v !== "object" || depth > 4) return null;
  if (v.inputSchema && typeof v.inputSchema === "object") return v.inputSchema;
  if (v.type === "object" && v.properties) return v;
  for (const x of Object.values(v)) { const s = findSchema(x, depth + 1); if (s) return s; }
  return null;
}

async function toolDetails(cfg, tool) {
  if (!tool.more) return tool;
  const details = (await call(cfg, "tools-more", { name: tool.name })).result?.structuredContent;
  return { ...tool, description: details?.tool?.description || tool.description,
    inputSchema: findSchema(details) };
}

function typedValue(key, value, type) {
  if (Array.isArray(type) && type.length === 2 && type.includes("null")) {
    type = type.find(item => item !== "null");
  }
  if (type === "boolean") {
    if (value === "true" || value === "false") return value === "true";
  } else if (type === "integer") {
    const number = Number(value);
    if (/^[+-]?\d+$/.test(value) && Number.isSafeInteger(number)) return number;
  } else if (type === "number") {
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  } else {
    return value;
  }
  throw new Usage(`${key}= expects a ${type} value. Use ${key}:=<json> to supply an explicit JSON value.`);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || (cmd === "help" && !rest.length)) { emit(process.stdout, USAGE); return 0; }
  if (cmd === "--version" || cmd === "version") { emit(process.stdout, VERSION); return 0; }
  const { pos, kv, flags, plainKeys } = parseArgs(rest, COMMANDS[cmd] || GENERIC);
  const json = data => emit(process.stdout, JSON.stringify(data?.result ?? data, null, 2));
  if (cmd === "help" && Object.hasOwn(COMMANDS, pos[0])) {
    const lines = COMMAND_USAGE.split(/\n(?=  c8o )/).filter(usage => usage.startsWith(`  c8o ${pos[0]} `));
    const usage = lines.join("\n") + "\n\n" + COMMON_OPTIONS;
    if (flags.json) json({ name: pos[0], usage });
    else emit(process.stdout, usage);
    return 0;
  }
  const cfg = config();
  secret = cfg.token;
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
      // the whole result: the engine shortens a large one for a model's context (resultCompacted), which broke the
      // checks an agent pipes into node or jq (i199, L3: 200 categories); a shell reads what it asks for
      const data = await call(cfg, "code-run", { project: project(cfg, flags), name: pos[0], input,
        detail: "full", includeFullResult: true, allowHugeResult: true });
      if (flags.json) { json(data); return failed(data) ? 1 : 0; }
      const sc = data?.result?.structuredContent;
      if (failed(data) || !sc) { emit(process.stderr, generic(data)); return failed(data) ? 1 : 0; }
      emit(process.stdout, JSON.stringify("result" in sc ? sc.result : null, null, 2));
      // next is shown only with unsaved sources: it says where their list is
      const notes = Object.entries(sc).filter(([k, v]) => !["ok", "result", "qname", "revision"].includes(k)
        && !(k === "next" && !(sc.unsavedSources?.count > 0)) && !(k === "unsavedSources" && v && v.count === 0)).map(([k, v]) => `${k}: ${show(v)}`);
      emit(process.stderr, notes.join("\n"));
      return 0;
    }
    case "call": {
      const form = { __sequence: pos[0] };
      for (const [k, v] of Object.entries(Object.assign({}, flags.input || {}, kv)))
        form[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
      if (flags.end || (flags.anonymous && !Object.hasOwn(form, "__removeSession"))) form.__removeSession = "true";
      const file = flags.anonymous ? null : jarFile(cfg, flags.as);
      const r = await appPost(Object.assign({}, cfg, { project: project(cfg, flags) }), file, form);
      if (file && flags.end) writeJar(file, { cookies: {}, paths: {} });
      let body = r.text, output = r.text, bad = r.status >= 400;
      try {
        body = JSON.parse(r.text);
        if (!flags.json) output = JSON.stringify(body, null, 2);
        bad = bad || (body && typeof body === "object" && !Array.isArray(body) && ("error" in body || "errors" in body));
      } catch { /* not JSON: printed as is */ }
      if (flags.json) {
        json({ status: r.status, setCookie: r.setCookie, body });
      } else {
        emit(bad ? process.stderr : process.stdout, (r.status >= 400 ? "HTTP " + r.status + "\n" : "") + output);
      }
      if (!flags.anonymous && !flags.end && r.sentCookies && r.status === 200 && body?.error?.code === "-1"
          && body.error.message === "Unable to execute the requested requestable.") {
        const shellArg = value => /^[\w.-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'";
        const end = `c8o session end${flags.as ? " --as " + shellArg(flags.as) : ""}${flags.project ? " --project " + shellArg(flags.project) : ""}`;
        emit(process.stderr, `c8o: Check the Flow name and that the Flow is public. A session keeps the project version from its first call: if this Flow was added later, run ${end}, then sign in again.`);
      }
      return bad ? 1 : 0;
    }
    case "session": {
      const file = jarFile(cfg, flags.as);
      if (pos[0] === "show") {
        const names = Object.keys(readJar(file).cookies);
        emit(process.stdout, names.length ? "session cookies: " + names.join(", ") : "no session");
        return 0;
      }
      if (pos[0] === "demo") {
        const url = demoUrl(cfg);
        if (!url) throw new Usage("This server provides no demo session. Never guess a password: report it.");
        if (!pos[1]) {
          let res;
          try { res = await fetch(url, { signal: AbortSignal.timeout(60_000) }); } catch (e) { throw new Protocol("Cannot reach the demo sessions (" + (e.cause?.code || e.name) + ")."); }
          if (!res.ok) throw new Usage("This server provides no demo session. Never guess a password: report it.");
          const j = await res.json();
          emit(process.stdout, (j.accounts || []).length ? "demo accounts: " + j.accounts.join(", ") : "no demo account");
          return 0;
        }
        const r = await appPost(Object.assign({}, cfg, { project: project(cfg, flags) }), file, { user: pos[1] }, url);
        let j = {};
        try { j = JSON.parse(r.text); } catch { /* reported below */ }
        if (r.status !== 200 || !j.signedIn) {
          emit(process.stderr, "c8o: no demo session for " + pos[1] + (j.error?.accounts ? " (demo accounts: " + j.error.accounts.join(", ") + ")" : "") + ". Never guess a password: report it.");
          return 1;
        }
        emit(process.stdout, "session opened: " + pos[1] + (flags.as ? " (--as " + flags.as + ")" : ""));
        return 0;
      }
      if (pos[0] === "cookie") {
        if (pos.length > 1) throw new Usage("c8o session cookie [--as <name>] [--url <viewer URL>]");
        const jar = readJar(file);
        if (!Object.keys(jar.cookies).length) {
          emit(process.stderr, "c8o: no session" + (flags.as ? " --as " + flags.as : "") + ": open one first (c8o session demo <account>, or c8o call <sign-in Flow>).");
          return 1;
        }
        let origin;
        try { origin = new URL(flags.url || cfg.browser); } catch {
          throw new Usage("Where does the browser reach the server? Add --url <viewer URL> (the first line of c8o view).");
        }
        const cookies = Object.entries(jar.cookies).map(([name, value]) => ({ name, value, domain: origin.hostname,
          path: jar.paths[name] || "/", httpOnly: true, secure: origin.protocol === "https:", sameSite: "Lax" }));
        emit(process.stdout, JSON.stringify(cookies));
        emit(process.stderr, "c8o: in the browser, run (browser_run_code_unsafe): async (page) => { await page.context().addCookies(<this JSON>); }, then open or reload the page.");
        return 0;
      }
      if (pos.length > 1) throw new Usage("c8o session end|show|cookie [--as <name>]");
      if (pos[0] !== "end") throw new Usage("c8o session end|show|cookie|demo [--as <name>]");
      if (!Object.keys(readJar(file).cookies).length) { emit(process.stdout, "no session"); return 0; }
      // the engine removes the session at the end of any request that carries __removeSession (GenericServlet)
      await appPost(Object.assign({}, cfg, { project: project(cfg, flags) }), file, { __removeSession: "true" });
      writeJar(file, { cookies: {}, paths: {} });
      emit(process.stdout, "session ended");
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
      const projectName = project(cfg, flags);
      const data = await call(cfg, "flow-block-get", { project: projectName, name: pos[0] });
      const details = data.result?.structuredContent?.error?.details;
      const providers = details?.workspaceProviders || [];
      if (providers.length) {
        const commands = referenceCommands(projectName, providers);
        if (flags.json) {
          details.referenceCommands = commands;
          json(data);
        } else {
          emit(process.stderr, [...texts(data), ...workspaceBlockLines(providers, details.workspaceGuides || [], commands)].join("\n"));
        }
      } else if (flags.json) json(data);
      else if (failed(data)) emit(process.stderr, generic(data));
      else emit(process.stdout, generic(data, 0));   // a contract is read whole: compact JSON
      return failed(data) ? 1 : 0;
    }
    case "blocks": {
      const args = { project: project(cfg, flags), detail: "summary" };
      if (pos.length) args.query = pos[0];
      if (flags.namespace) args.namespace = flags.namespace;
      const blocks = [];
      const providers = new Map(), guides = new Set();
      do {
        const data = await call(cfg, "flow-catalog", args);
        if (failed(data)) {
          if (flags.json) json(data); else emit(process.stderr, generic(data));
          return 1;
        }
        const page = data.result?.structuredContent;
        if (!Array.isArray(page?.blocks) || (page.nextCursor && page.nextCursor === args.cursor))
          throw new Protocol("Invalid block catalog page.");
        for (const block of page.blocks) blocks.push(block);
        for (const provider of page.workspaceProviders || []) providers.set(`${provider.project}:${provider.block}`, provider);
        for (const guide of page.workspaceGuides || []) guides.add(guide);
        args.cursor = page.nextCursor;
      } while (args.cursor);
      const workspaceProviders = [...providers.values()], workspaceGuides = [...guides];
      const commands = referenceCommands(args.project, workspaceProviders);
      if (flags.json) json({ blocks, workspaceProviders, workspaceGuides, referenceCommands: commands });
      else emit(process.stdout, [
        ...blocks.map(block => [block.block, block.desc].filter(Boolean).join(": ")),
        ...workspaceBlockLines(workspaceProviders, workspaceGuides, commands),
      ].join("\n"));
      return 0;
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
      if (!t) throw new Usage(`Unknown command or tool: ${pos[0]}. See c8o help and c8o tools.`);
      const details = await toolDetails(cfg, t);
      if (flags.json) json({ name: t.name, description: t.description, inputSchema: details.inputSchema || null });
      else emit(process.stdout, schemaLines(details, details.inputSchema));
      return 0;
    }
    default: {
      const t = await findTool(cfg, cmd);
      if (!t) throw new Usage(`Unknown command or tool: ${cmd}. See c8o help and c8o tools.`);
      const args = Object.assign({}, flags.args || {}, kv);
      const { inputSchema } = await toolDetails(cfg, t);
      const properties = inputSchema?.properties;
      for (const key of plainKeys) args[key] = typedValue(key, args[key], properties?.[key]?.type);
      if (properties?.project && args.project === undefined && (flags.project || cfg.project)) args.project = project(cfg, flags);
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
