// node --test cli/c8o.test.mjs : c8o against a fake Flow MCP endpoint (answers shaped like the real ones).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const C8O = join(dirname(fileURLToPath(import.meta.url)), "c8o.mjs");
const calls = [], appCalls = [];
let server, serverReady, url, viewerRunning = false;
const unavailableRequestable = { error: { code: "-1", message: "Unable to execute the requested requestable.",
  details: "", context: "", exception: "", stacktrace: "", attr: { project: "P", sequence: "new_flow", type: "c8o" } } };

const TOOLS = [
  { name: "flow-source-sync", description: "Checks and saves changed source files. More.", inputSchema: { type: "object", required: ["project"],
    properties: { project: { type: "string", description: "Project." }, paths: { type: "array" }, dryRun: { type: "boolean" } } } },
  { name: "code-run", description: "Runs a Flow.", inputSchema: { type: "object", properties: { project: { type: "string" }, name: { type: "string" } } } },
  { name: "numeric-tool", inputSchema: { type: "object", properties: {
    count: { type: "integer" }, rate: { type: "number" },
    nullableFlag: { type: ["boolean", "null"] }, nullableCount: { type: ["null", "integer"] },
    nullableRate: { type: ["number", "null"] }, nullableText: { type: ["string", "null"] },
    mixed: { type: ["boolean", "integer", "null"] },
  } } },
  { name: "flow-resource-search", description: "Searches guides.", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
  { name: "echo-secret", description: "Echoes.", inputSchema: { type: "object", properties: {} } },
  { name: "tools-more", description: "The tools outside this list.", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
];
const SKILL = "---\nname: convertigo-flow-cli\ndescription: Build or change a Flow project with c8o.\n---\n\n# Convertigo Flow with c8o\n";
const MORE = [{ name: "scheduler-list", description: "Lists jobs." }, { name: "scheduler-apply", description: "Preview or save jobs." }];
const MORE_SCHEMA = {
  "scheduler-list": { type: "object", properties: { project: { type: "string", description: "Project." } } },
  "scheduler-apply": { type: "object", properties: {
    project: { type: "string" }, dryRun: { type: "boolean", default: true }, enabled: { type: "boolean", default: true },
    name: { type: "string" },
  } },
};

const SQL_PROVIDER = { block: "sql.query", project: "lib_flow_sql" };
const SQL_GUIDE = "flow://lib/lib_flow_sql/sql";
const diag = { severity: "error", code: "INVALID_EXPRESSION", line: 7, block: "if", property: "condition",
  message: "Unknown expression function: date.add", expression: "!date.add({})", hint: "Call date.add on its own line." };
const ok = (extra = {}) => ({ result: { content: [{ type: "text", text: "OK. app.x. keys: ok, name. Use structuredContent for data." }],
  structuredContent: { ok: true, ...extra } } });
const SYNC = {
  isError: true,
  content: [{ type: "text", text: "Error [FLOWSCRIPT_VALIDATION_FAILED]: at line 7. See structuredContent.error." }],
  structuredContent: { ok: false, dryRun: false, summary: { checked: 4, applied: 3, refused: 2, rewritten: 1 },
    results: [
      { path: "_flow/blocks/app/x.block.js", type: "block", applied: true, rewritten: true, note: "The engine normalized this file.",
        response: ok({ warnings: ["Move structural endpoints to config."] }) },
      { path: "_flow/flows/w.flow.js", type: "flow", applied: true,
        response: { result: { content: [{ type: "text", text: "OK. warnings=1: Put the related writes in one sql.transaction. keys: ok, qname. Use structuredContent for data." }],
          structuredContent: { ok: true } } } },
      { path: "_flow/flows/p.flow.js", type: "flow", applied: true, note: "Changed on disk during the sync: sync it again.", response: ok() },
      { path: "_flow/flows/a.flow.js", type: "flow", note: "Not saved.",
        response: { result: { isError: true, content: [{ type: "text", text: "Error [FLOWSCRIPT_VALIDATION_FAILED]: at line 7" }],
          structuredContent: { ok: false, error: { code: "FLOWSCRIPT_VALIDATION_FAILED", diagnostics: [diag] } } } } },
      { path: "_flow/data/model.yaml", type: "model", note: "Not saved.",
        response: { result: { isError: true, content: [{ type: "text", text: "Error [ENTITY_MODEL_INVALID]" }],
          structuredContent: { ok: false, error: { code: "ENTITY_MODEL_INVALID", proposedPatch: { type: "int64" }, diagnostics: [{
            severity: "error", code: "ENTITY_MODEL_INVALID", path: "entities.Deal.fields.amount.type", message: "unknown type" }] } } } } },
      { path: "_flow/flows/b.flow.js", type: "flow", note: "Not saved.",
        response: { result: { isError: true, content: [{ type: "text", text: "Error [FLOWSCRIPT_V3_UNSUPPORTED]: line 5" }],
          structuredContent: { ok: false, error: { code: "FLOWSCRIPT_V3_UNSUPPORTED", details: [{ severity: "error",
            code: "FLOWSCRIPT_V3_UNSUPPORTED", line: 5, message: "Outside the FlowScript v3 subset.", hint: "Use a v3 form." }] } } } } },
    ] },
};

function answer(name, args) {
  if (name === "flow-source-sync") {
    if (args.dryRun) return { content: [{ type: "text", text: "No changed source since the last sync." }],
      structuredContent: { ok: true, dryRun: true, results: [], summary: { checked: 0, applied: 0, refused: 0, rewritten: 0 } } };
    return SYNC;
  }
  if (name === "code-run") return { content: [{ type: "text", text: "OK. keys: ok, result, qname. Use structuredContent for data." }],
    structuredContent: { ok: true, qname: "P.f", revision: "abc", result: { echo: args.input }, accessibilityNote: "f is public.",
      unsavedSources: { count: 0 } } };
  if (name === "frontend-svelte-action") {
    if (args.actionId === "dev.ensure") { viewerRunning = true; return { content: [], structuredContent: { status: "running" } }; }
    if (args.project === "Stopped" && !viewerRunning) return { content: [], structuredContent: { generated: false, status: "stopped",
      stopReason: "not-started", next: "dev.ensure(wait:true)" } };
    return { content: [{ type: "text", text: "OK. keys: ok, openUrl. Use structuredContent for data." }],
      structuredContent: args.wait === "nourl" ? { ok: true, pending: true } : { ok: true, openUrl: "http://127.0.0.1:1/app/", status: "ready", args } };
  }
  if (name === "flow-resource-get" && args.uri === "flow://skills/convertigo-flow-cli/SKILL")
    return { content: [{ type: "text", text: SKILL }] };
  if (name === "flow-resource-get") return { content: [{ type: "text", text: "# Guide " + args.uri + "\nkeys: kept as written" }] };
  if (name === "flow-catalog" && args.namespace === "sql") return ok({
    blocks: [], workspaceProviders: [SQL_PROVIDER], workspaceGuides: [SQL_GUIDE],
  }).result;
  if (name === "flow-catalog") return ok(args.cursor ?
    { blocks: [{ block: "json.parse", desc: "Parse JSON." }] } :
    { blocks: [{ block: "json.object", desc: "Create an object." }], nextCursor: "next" }).result;
  if (name === "flow-block-get") return { isError: true, content: [{ type: "text", text: "Error [UNKNOWN_BLOCK]: Unknown Flow block." }],
    structuredContent: { error: { code: "UNKNOWN_BLOCK", ...(args.name === "sql.query" ?
      { details: { workspaceProviders: [SQL_PROVIDER], workspaceGuides: [SQL_GUIDE] } } :
      { hint: "Inspect json.object." }) } } };
  if (name === "scheduler-list") return { content: [{ type: "text", text: "OK. keys: ok, jobs. Use structuredContent for data." }],
    structuredContent: { ok: true, jobs: [{ name: "daily", project: args.project }] } };
  if (name === "scheduler-apply") return ok({ saved: args.dryRun === false }).result;
  if (name === "numeric-tool") return ok().result;
  if (name === "flow-resource-search") return { content: [{ type: "text", text: "count=1. Use structuredContent for data." }],
    structuredContent: { count: 1, hadProject: "project" in args } };
  if (name === "echo-secret") return { content: [{ type: "text", text: "header was Bearer secret-value" }] };
  if (name === "tools-more") {
    if (!args.name) return { content: [], structuredContent: { ok: true, tools: MORE } };
    if (!args.arguments) return { content: [], structuredContent: { ok: true, tool: { name: args.name,
      description: args.name === "scheduler-apply" ? "Preview or save jobs. Preview is the default." : undefined,
      inputSchema: MORE_SCHEMA[args.name] } } };
    return answer(args.name, args.arguments);
  }
  return { isError: true, content: [{ type: "text", text: "Unknown tool" }] };
}

async function startServer() {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      if (req.url === "/demo-session") {  // the bench relay: demo accounts opened without their password
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") { res.end(JSON.stringify({ accounts: ["m@example.com"] })); return; }
        const form = Object.fromEntries(new URLSearchParams(body));
        appCalls.push({ url: req.url, cookie: req.headers.cookie || "", form });
        if (form.user !== "m@example.com") { res.statusCode = 404; res.end(JSON.stringify({ error: { code: "DEMO_ACCOUNT_UNKNOWN", accounts: ["m@example.com"] } })); return; }
        res.setHeader("Set-Cookie", "JSESSIONID=s" + appCalls.length + "; Path=/convertigo");
        res.end(JSON.stringify({ user: form.user, signedIn: true }));
        return;
      }
      if (req.url.startsWith("/app/")) {  // the project's HTTP endpoint (c8o call), with a cookie session
        const form = Object.fromEntries(new URLSearchParams(body));
        appCalls.push({ url: req.url, method: req.method, hasCookie: Object.hasOwn(req.headers, "cookie"), cookie: req.headers.cookie || "", form });
        res.setHeader("Content-Type", "application/json");
        const removeSession = Object.hasOwn(form, "__removeSession") && form.__removeSession !== "false";
        if (removeSession && req.headers.cookie) { res.setHeader("Set-Cookie", "JSESSIONID=; Max-Age=0; Path=/"); res.end("{}"); return; }
        if (form.__sequence === "public") {
          if (!removeSession) {
            res.setHeader("Set-Cookie", ["JSESSIONID=s" + appCalls.length + "; Path=/convertigo", "theme=light; Expires=Wed, 21 Oct 2037 07:28:00 GMT"]);
          }
          res.end(JSON.stringify({ message: form.message }));
          return;
        }
        if (form.__sequence === "missing") {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain");
          res.end("not found\n");
          return;
        }
        if (form.__sequence === "new_flow") { res.end(JSON.stringify(unavailableRequestable)); return; }
        if (form.__sequence === "login") { res.setHeader("Set-Cookie", "JSESSIONID=s" + appCalls.length + "; Path=/convertigo; HttpOnly"); res.end(JSON.stringify({ ok: true })); return; }
        if (/JSESSIONID=s\d+/.test(req.headers.cookie || "")) { res.end(JSON.stringify({ user: "manager", n: form.n, list: form.list })); return; }
        res.end(JSON.stringify({ error: { message: "session required" } }));
        return;
      }
      const m = JSON.parse(body);
      calls.push({ url: req.url, headers: req.headers, body: m });
      if (m.params?.arguments?.name === "broken") { res.statusCode = 500; res.end("<html>oops</html>"); return; }
      if (m.params?.arguments?.name === "both") { res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: {}, error: { code: 1 } })); return; }
      const result = m.method === "tools/list" ? { tools: TOOLS } : answer(m.params.name, m.params.arguments);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/flow`;
}
after(() => server?.close());

const freshTmp = () => mkdtempSync(join(tmpdir(), "c8o-tmp-"));
async function c8o(args, env = {}) {
  if (env.C8O_URL !== "") await (serverReady ??= startServer());
  return new Promise(resolve => {
    const p = spawn(process.execPath, [C8O, ...args], { env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), "c8o-home-")),
      TMPDIR: freshTmp(), C8O_URL: url, C8O_PROJECT: "P", C8O_CONFIG: "/nonexistent", ...env } });
    let out = "", err = "";
    p.stdout.on("data", d => out += d); p.stderr.on("data", d => err += d);
    p.on("close", code => resolve({ code, out, err }));
  });
}
const last = () => calls[calls.length - 1];

test("help needs no endpoint", async () => {
  const r = await c8o(["help"], { C8O_URL: "" });
  assert.equal(r.code, 0);
  assert.match(r.out, /c8o check \[path\.\.\.\]/);
  assert.match(r.out, /2 usage, connection or protocol error/);
  assert.equal((await c8o(["--version"], { C8O_URL: "" })).out.trim(), "0.6.0");
});

test("help lists each local command and its options without an endpoint", async () => {
  const options = {
    check: ["--gateway"], sync: ["--gateway"], run: ["--input"], call: ["--input", "--as", "--end", "--anonymous", "--json"],
    session: ["--as", "--url"], view: [], block: [], blocks: ["--namespace"], guide: [], tools: [],
    skill: ["--install"], help: [], version: [],
  };
  for (const [command, flags] of Object.entries(options)) {
    const r = await c8o(["help", command], { C8O_URL: "" });
    assert.equal(r.code, 0, r.err);
    const lines = r.out.trim().split("\n").map(line => line.trim());
    const usages = lines.filter(line => line.startsWith("c8o "));
    assert.equal(usages.length, command === "session" ? 3 : 1, r.out);
    assert.ok(usages.every(line => line.startsWith(`c8o ${command} `)), r.out);
    for (const flag of flags) assert.ok(r.out.includes(flag), r.out);
  }
});

test("help returns JSON for a local command without an endpoint", async () => {
  const r = await c8o(["help", "call", "--json"], { C8O_URL: "" });
  assert.equal(r.code, 0, r.err);
  const help = JSON.parse(r.out);
  assert.equal(help.name, "call");
  assert.match(help.usage, /c8o call <flow>/);
  assert.match(help.usage, /--end/);
  assert.match(help.usage, /--json/);
});

test("sync: refused, pending, normalized and warned files; file:line diagnostics; exit 1", async () => {
  const r = await c8o(["sync"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^_flow\/flows\/a\.flow\.js:7: error INVALID_EXPRESSION \(if\.condition\): Unknown expression function: date\.add$/m);
  assert.match(r.out, /^ {2}expression: !date\.add\(\{\}\)$/m);
  assert.match(r.out, /^ {2}fix: Call date\.add on its own line\.$/m);
  assert.match(r.out, /^_flow\/flows\/b\.flow\.js:5: error FLOWSCRIPT_V3_UNSUPPORTED: Outside the FlowScript v3 subset\.$/m);
  assert.match(r.out, /^_flow\/flows\/p\.flow\.js: PENDING/m);
  assert.match(r.out, /^_flow\/blocks\/app\/x\.block\.js: saved, normalized by the engine: read it again \(block\)$/m);
  assert.match(r.out, /warning: Move structural endpoints to config\./);
  assert.match(r.out, /^ {2}warnings=1: Put the related writes in one sql\.transaction\.$/m);
  assert.match(r.out, /4 checked, 3 saved, 2 refused, 1 normalized\./);
  assert.match(r.out, /^_flow\/data\/model\.yaml: error ENTITY_MODEL_INVALID \(entities\.Deal\.fields\.amount\.type\): unknown type$/m);
  assert.match(r.out, /^ {2}proposed patch: \{"type":"int64"\}$/m);
  assert.match(r.out, /model\.yaml[^]*?not saved: the engine keeps the last synced version\./);
  assert.doesNotMatch(r.out, /structuredContent|keys: ok/);
  assert.deepEqual(last().body.params.arguments, { project: "P", dryRun: false });
  assert.equal(last().headers["x-convertigo-source-mode"], "sources");
  assert.equal(last().headers["x-convertigo-no-log"], "true");
  assert.equal(last().headers.authorization, undefined);
  assert.match(last().url, /^\/flow\?jsonOnly=true$/);
});

test("check: dry run with normalized paths; options are checked per command", async () => {
  let r = await c8o(["check", "./_flow/flows/a.flow.js", "/project/_flow/data/model.yaml", "--gateway"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /No changed source since the last sync\./);
  assert.deepEqual(last().body.params.arguments,
    { project: "P", dryRun: true, paths: ["_flow/flows/a.flow.js", "_flow/data/model.yaml"], gateway: true });
  const n = calls.length;
  for (const bad of [["sync", "--project", "--json"], ["sync", "paths=_flow/x"], ["run", "f", "g"], ["run"], ["view", "--gateway"], ["sync", "--nope"], ["block"]]) {
    r = await c8o(bad);
    assert.equal(r.code, 2, bad.join(" "));
  }
  assert.equal(calls.length, n, "a usage error never calls the engine");
});

test("run: JSON result alone on stdout, notes on stderr, k=v over --input", async () => {
  const r = await c8o(["run", "f", "--input", '{"a":1,"b":"x"}', "b=y", "n:=3", "flag:=true"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments, { project: "P", name: "f", input: { a: 1, b: "y", n: 3, flag: true },
    detail: "full", includeFullResult: true, allowHugeResult: true });  // never the engine's shortened result
  assert.deepEqual(JSON.parse(r.out), { echo: { a: 1, b: "y", n: 3, flag: true } });
  assert.equal(r.err.trim(), "accessibilityNote: f is public.");
});

test("view: the URL first, extra arguments passed; no URL is a failure", async () => {
  let r = await c8o(["view", "wait:=false"]);
  assert.equal(r.code, 0);
  assert.equal(r.out.split("\n")[0], "http://127.0.0.1:1/app/");
  assert.deepEqual(last().body.params.arguments, { actionId: "dev.sync", wait: false, project: "P" });
  r = await c8o(["view", "wait=nourl"]);
  assert.equal(r.code, 1);
  // a stopped viewer: dev.ensure (wait), then dev.sync again
  const n = calls.length;
  r = await c8o(["view", "--project", "Stopped"]);
  assert.equal(r.code, 0);
  assert.equal(r.out.split("\n")[0], "http://127.0.0.1:1/app/");
  assert.deepEqual(calls.slice(n).map(c => c.body.params.arguments.actionId), ["dev.sync", "dev.ensure", "dev.sync"]);
  assert.equal(calls[n + 1].body.params.arguments.wait, true);
  assert.match(r.err, /viewer was stopped; started it \(dev\.ensure\)/);
});

test("guide: served as written, a file path of the guide folder read as its URI", async () => {
  const r = await c8o(["guide", "/c8o/guide/entities/model.md"]);
  assert.equal(r.out, "# Guide flow://guide/entities/model\nkeys: kept as written\n");
  await c8o(["guide"]);
  assert.equal(last().body.params.arguments.uri, "flow://guide/start");
});

test("blocks reuses the catalog filters and displays unknown-block guidance", async () => {
  const start = calls.length;
  const listed = await c8o(["blocks", "object", "--namespace", "json"]);
  assert.equal(listed.code, 0);
  assert.match(listed.out, /json\.object: Create an object\.\njson\.parse: Parse JSON\./);
  assert.deepEqual(calls.slice(start).map(c => c.body.params), [
    { name: "flow-catalog", arguments: { project: "P", detail: "summary", query: "object", namespace: "json" } },
    { name: "flow-catalog", arguments: { project: "P", detail: "summary", query: "object", namespace: "json", cursor: "next" } },
  ]);
  const unknown = await c8o(["block", "json.value"]);
  assert.equal(unknown.code, 1);
  assert.match(unknown.err, /Inspect json\.object/);
  const reference = "c8o flow-project-reference project=NoSql reference=lib_flow_sql";
  for (const command of [["blocks", "--namespace", "sql"], ["block", "sql.query"]]) {
    const args = [...command, "--project", "NoSql"];
    const isBlock = command[0] === "block";
    const result = await c8o(args);
    assert.equal(result.code, isBlock ? 1 : 0);
    const output = isBlock ? result.err : result.out;
    assert.match(output, /sql\.query: provided by lib_flow_sql/);
    assert.ok(output.includes(reference) && output.includes(SQL_GUIDE));
    const report = JSON.parse((await c8o([...args, "--json"])).out);
    const discovery = isBlock ? report.structuredContent.error.details : report;
    assert.deepEqual(discovery.workspaceProviders, [SQL_PROVIDER]);
    assert.deepEqual(discovery.workspaceGuides, [SQL_GUIDE]);
    assert.deepEqual(discovery.referenceCommands, [reference]);
  }
});

test("tools behind tools-more: listed, described and called through tools-more with the project", async () => {
  let r = await c8o(["tools", "scheduler-list"]);
  assert.equal(r.out.trim(), "scheduler-list: Lists jobs.");
  r = await c8o(["tools", "scheduler-list", "--json"]);
  assert.deepEqual(JSON.parse(r.out).map(t => t.name), ["scheduler-list"]);
  r = await c8o(["help", "scheduler-list"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^ {2}project \(string\): Project\.$/m);
  r = await c8o(["help", "flow-source-sync", "--json"]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).name, "flow-source-sync");
  r = await c8o(["help", "unknown-name"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /Unknown command or tool: unknown-name/);
  r = await c8o(["scheduler-list"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params, { name: "tools-more", arguments: { name: "scheduler-list", arguments: { project: "P" } } });
  assert.match(r.out, /"name": "daily"/);
  r = await c8o(["flow-resource-search", "query=date", "--json"]);
  assert.deepEqual(last().body.params.arguments, { query: "date" });
  assert.equal(JSON.parse(r.out).structuredContent.hadProject, false);
  r = await c8o(["code-set", "x=1"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /Unknown command or tool: code-set/);
});

test("scheduler help uses the detailed description and shows boolean defaults", async () => {
  const r = await c8o(["help", "scheduler-apply"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /\bdryRun \(boolean, default: true\)/);
  assert.match(r.out, /\benabled \(boolean, default: true\)/);
  assert.match(r.out, /^scheduler-apply: Preview or save jobs\. Preview is the default\./m);
});

test("scheduler key=value uses the advertised types and preserves explicit JSON", async () => {
  const r = await c8o(["scheduler-apply", "dryRun=false", 'enabled:="true"', "name=42", "--json"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments.arguments, { dryRun: false, enabled: "true", name: "42", project: "P" });
  assert.equal(JSON.parse(r.out).structuredContent.saved, true);
  const invalid = await c8o(["scheduler-apply", "dryRun=no"]);
  assert.equal(invalid.code, 2);
  assert.match(invalid.err, /dryRun.*boolean.*dryRun:=<json>/);
  assert.equal(last().body.params.arguments.arguments, undefined);
});

test("numeric key=value accepts finite numbers and rejects invalid integers and numbers", async () => {
  for (const [key, value] of [
    ["count", "1.0000000000000001"], ["count", "1.5"], ["count", "1.0"], ["count", "1e3"],
    ["count", "9007199254740992"], ["rate", ""], ["rate", "1e999"],
  ]) {
    const invalid = await c8o(["numeric-tool", key + "=" + value]);
    assert.equal(invalid.code, 2);
    assert.ok(invalid.err.includes(key + ":=<json>"));
  }
  const r = await c8o(["numeric-tool", "count=-3", "rate=1.25e-2"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments, { count: -3, rate: 0.0125 });
});

test("key=value coerces nullable scalars and preserves other unions as strings", async () => {
  const r = await c8o(["numeric-tool", "nullableFlag=false", "nullableCount=+0012",
    "nullableRate=1e3", "nullableText=0012", "mixed=false"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments, {
    nullableFlag: false, nullableCount: 12, nullableRate: 1000, nullableText: "0012", mixed: "false",
  });
});

test("skill: printed as served, or installed in a skills folder", async () => {
  let r = await c8o(["skill"]);
  assert.equal(r.code, 0);
  assert.equal(r.out, SKILL);
  assert.deepEqual(last().body.params.arguments, { uri: "flow://skills/convertigo-flow-cli/SKILL", format: "text" });
  const dir = mkdtempSync(join(tmpdir(), "c8o-skills-"));
  r = await c8o(["skill", "--install", dir]);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), join(dir, "convertigo-flow-cli", "SKILL.md"));
  assert.equal(readFileSync(join(dir, "convertigo-flow-cli", "SKILL.md"), "utf8"), SKILL);
  r = await c8o(["skill", "x=1"]);
  assert.equal(r.code, 2);
});

test("call: a cookie session kept between calls, named sessions, ended by __removeSession", async () => {
  const tmp = freshTmp();
  let r = await c8o(["call", "whoami"], { TMPDIR: tmp });
  assert.equal(r.code, 1);
  assert.match(r.err, /session required/);
  r = await c8o(["call", "login", "user=m@example.com", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.code, 0);
  assert.equal(appCalls[appCalls.length - 1].url, "/app/P/.json");
  assert.deepEqual(appCalls[appCalls.length - 1].form, { __sequence: "login", user: "m@example.com" });
  r = await c8o(["session", "show", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.out.trim(), "session cookies: JSESSIONID");
  r = await c8o(["call", "whoami", "--as", "m", "n:=3", "list:=[1,2]"], { TMPDIR: tmp });
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.out), { user: "manager", n: "3", list: "[1,2]" });
  assert.match(appCalls[appCalls.length - 1].cookie, /^JSESSIONID=s\d+$/);
  r = await c8o(["call", "whoami"], { TMPDIR: tmp });  // another session: not signed in
  assert.equal(r.code, 1);
  r = await c8o(["session", "end", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.out.trim(), "session ended");
  assert.equal(appCalls[appCalls.length - 1].form.__removeSession, "true");
  assert.match(appCalls[appCalls.length - 1].cookie, /^JSESSIONID=s\d+$/);
  r = await c8o(["session", "show", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.out.trim(), "no session");
  r = await c8o(["call", "login", "--as", "m", "--end"], { TMPDIR: tmp });
  assert.equal(appCalls[appCalls.length - 1].form.__removeSession, "true");
  r = await c8o(["session", "show", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.out.trim(), "no session");
});

test("call --anonymous --json: defaults to a stateless POST without touching the jar", async () => {
  const tmp = freshTmp();
  const env = { TMPDIR: tmp };
  const args = ["call", "public", "message=hello", "--as", "m", "--anonymous", "--json"];
  let r = await c8o(args, env);
  assert.equal(r.code, 0, r.err);
  assert.equal(appCalls.at(-1).form.__removeSession, "true");
  assert.deepEqual(readdirSync(tmp), []);

  r = await c8o(["call", "login", "--as", "m"], env);
  assert.equal(r.code, 0, r.err);
  const dir = join(tmp, "c8o-" + userInfo().uid);
  const [name] = readdirSync(dir);
  const file = join(dir, name);
  const before = readFileSync(file);
  const inode = statSync(file).ino;

  r = await c8o(args, env);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.err, "");
  assert.equal(appCalls.at(-1).method, "POST");
  assert.equal(appCalls.at(-1).hasCookie, false);
  assert.equal(appCalls.at(-1).form.__removeSession, "true");
  assert.deepEqual(JSON.parse(r.out), { status: 200, setCookie: [], body: { message: "hello" } });
  assert.deepEqual(readdirSync(dir), [name]);
  assert.deepEqual(readFileSync(file), before);
  assert.equal(statSync(file).ino, inode);

  for (const explicit of [
    ["__removeSession=false"],
    ["--input", '{"__removeSession":false}'],
  ]) {
    r = await c8o([...args, ...explicit], env);
    assert.equal(r.code, 0, r.err);
    assert.equal(appCalls.at(-1).form.__removeSession, "false");
    assert.equal(appCalls.at(-1).hasCookie, false);
    assert.deepEqual(JSON.parse(r.out), { status: 200, setCookie: ["JSESSIONID", "theme"], body: { message: "hello" } });
    assert.deepEqual(readFileSync(file), before);
    assert.equal(statSync(file).ino, inode);
  }
  r = await c8o([...args, "--end", "__removeSession=false"], env);
  assert.equal(r.code, 0, r.err);
  assert.equal(appCalls.at(-1).form.__removeSession, "true");
  assert.equal(appCalls.at(-1).hasCookie, false);
  assert.deepEqual(readFileSync(file), before);
  r = await c8o(args.filter(arg => arg !== "--anonymous"), env);
  assert.equal(r.code, 0, r.err);
  assert.equal(appCalls.at(-1).hasCookie, true);
  assert.equal(Object.hasOwn(appCalls.at(-1).form, "__removeSession"), false);
});

test("call --json: HTTP 200 application errors and HTTP 404 text are both on stdout with exit 1", async () => {
  let r = await c8o(["call", "whoami", "--anonymous", "--json"]);
  assert.equal(r.code, 1);
  assert.equal(r.err, "");
  assert.deepEqual(JSON.parse(r.out), { status: 200, setCookie: [], body: { error: { message: "session required" } } });

  r = await c8o(["call", "missing", "--json"]);
  assert.equal(r.code, 1);
  assert.equal(r.err, "");
  assert.deepEqual(JSON.parse(r.out), { status: 404, setCookie: [], body: "not found\n" });
});

test("call: an unavailable requestable in an existing named session suggests signing in again", async () => {
  const env = { TMPDIR: freshTmp() };
  const open = await c8o(["call", "login", "--as", "reviewer"], env);
  assert.equal(open.code, 0, open.err);
  const args = ["call", "new_flow", "--as", "reviewer"];
  const hint = "c8o: Check the Flow name and that the Flow is public. A session keeps the project version from its first call: if this Flow was added later, run c8o session end --as reviewer, then sign in again.\n";
  const before = appCalls.length;
  let r = await c8o(args, env);
  assert.equal(r.code, 1);
  assert.equal(r.out, "");
  assert.equal(appCalls.length, before + 1);
  assert.equal(r.err, JSON.stringify(unavailableRequestable, null, 2) + "\n" + hint);

  r = await c8o([...args, "--json"], env);
  assert.equal(r.code, 1);
  assert.deepEqual(JSON.parse(r.out), { status: 200, setCookie: [], body: unavailableRequestable });
  assert.equal(r.err, hint);
  assert.equal(appCalls.length, before + 2);

  for (const [otherwise, otherEnv] of [
    [args, { TMPDIR: freshTmp() }],
    [[...args, "--anonymous"], env],
    [["call", "missing", "--as", "reviewer"], env],
  ]) {
    r = await c8o([...otherwise, "--json"], otherEnv);
    assert.equal(r.code, 1);
    assert.equal(r.err, "");
  }

  // the default kept session (no --as) gets the same hint, without --as in the command
  const plain = { TMPDIR: freshTmp() };
  assert.equal((await c8o(["call", "login"], plain)).code, 0);
  r = await c8o(["call", "new_flow", "--json"], plain);
  assert.equal(r.code, 1);
  assert.equal(r.err, hint.replace(" --as reviewer", ""));
});

test("session demo: accounts listed, a session opened without a password, an unknown account refused", async () => {
  const tmp = freshTmp();
  let r = await c8o(["session", "demo"], { TMPDIR: tmp });
  assert.equal(r.out.trim(), "demo accounts: m@example.com");
  r = await c8o(["session", "demo", "m@example.com", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "session opened: m@example.com (--as m)");
  assert.deepEqual(appCalls[appCalls.length - 1].form, { user: "m@example.com" });
  r = await c8o(["call", "whoami", "--as", "m"], { TMPDIR: tmp });
  assert.equal(r.code, 0);
  r = await c8o(["session", "demo", "x@example.com", "--as", "x"], { TMPDIR: tmp });
  assert.equal(r.code, 1);
  assert.match(r.err, /no demo session for x@example\.com \(demo accounts: m@example\.com\)\. Never guess a password/);
  r = await c8o(["session", "demo"], { TMPDIR: tmp, C8O_URL: url.replace("/flow", "/mcp-elsewhere") });
  assert.equal(r.code, 2);
  assert.match(r.err, /provides no demo session/);
});

test("session cookie: the session's cookies for Playwright's addCookies, with their path; none without a session", async () => {
  const tmp = freshTmp();
  let r = await c8o(["session", "cookie", "--as", "m"], { TMPDIR: tmp, C8O_BROWSER_URL: "http://127.0.0.1:19600" });
  assert.equal(r.code, 1);
  assert.match(r.err, /no session --as m: open one first/);
  await c8o(["session", "demo", "m@example.com", "--as", "m"], { TMPDIR: tmp });
  r = await c8o(["session", "cookie", "--as", "m"], { TMPDIR: tmp });  // the relay's endpoint says nothing of the browser
  assert.equal(r.code, 2);
  assert.match(r.err, /--url <viewer URL>/);
  r = await c8o(["session", "cookie", "--as", "m"], { TMPDIR: tmp, C8O_BROWSER_URL: "http://127.0.0.1:19600" });
  assert.equal(r.code, 0);
  const [cookie, ...more] = JSON.parse(r.out);
  assert.equal(more.length, 0);
  assert.deepEqual({ ...cookie, value: "*" }, { name: "JSESSIONID", value: "*", domain: "127.0.0.1", path: "/convertigo",
    httpOnly: true, secure: false, sameSite: "Lax" });
  assert.match(r.err, /addCookies/);
  r = await c8o(["session", "cookie", "--as", "m", "--url", "https://viewer.example.com:8443/convertigo/gw/x/"], { TMPDIR: tmp });
  assert.equal(JSON.parse(r.out)[0].domain, "viewer.example.com");
  assert.equal(JSON.parse(r.out)[0].secure, true);
  r = await c8o(["call", "whoami", "--as", "m"], { TMPDIR: tmp });  // the session itself is unchanged
  assert.equal(r.code, 0);
  r = await c8o(["session", "end", "--as", "m"], { TMPDIR: tmp });
  r = await c8o(["session", "cookie", "--as", "m"], { TMPDIR: tmp, C8O_BROWSER_URL: "http://127.0.0.1:19600" });
  assert.equal(r.code, 1);
});

test("the tool list is cached per user and identity", async () => {
  const tmp = freshTmp();
  await c8o(["tools"], { TMPDIR: tmp });
  const n = calls.filter(c => c.body.method === "tools/list").length;
  await c8o(["scheduler-list"], { TMPDIR: tmp });
  assert.equal(calls.filter(c => c.body.method === "tools/list").length, n);
});

test("token file: sent as a bearer header, masked in any output", async () => {
  const f = join(mkdtempSync(join(tmpdir(), "c8o-tok-")), "token");
  writeFileSync(f, "secret-value\n");
  let r = await c8o(["view"], { C8O_TOKEN_FILE: f });
  assert.equal(last().headers.authorization, "Bearer secret-value");
  r = await c8o(["echo-secret"], { C8O_TOKEN_FILE: f });
  assert.match(r.out, /Bearer <token>/);
  r = await c8o(["echo-secret", "--json"], { C8O_TOKEN_FILE: f });
  assert.doesNotMatch(r.out + r.err, /secret-value/);
});

test("connection refused and protocol errors: exit 2 with a short message", async () => {
  let r = await c8o(["view"], { C8O_URL: "http://127.0.0.1:9/flow" });
  assert.equal(r.code, 2);
  assert.match(r.err, /^c8o: Cannot reach the engine/);
  r = await c8o(["run", "broken"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /^c8o: No JSON-RPC answer from the engine \(HTTP 500\)/);
  r = await c8o(["run", "both"]);
  assert.equal(r.code, 2);
});
