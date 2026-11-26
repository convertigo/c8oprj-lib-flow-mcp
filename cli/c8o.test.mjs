// node --test cli/c8o.test.mjs : c8o against a fake Flow MCP endpoint (answers shaped like the real ones).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const C8O = join(dirname(fileURLToPath(import.meta.url)), "c8o.mjs");
const calls = [];
let server, url, viewerRunning = false;

const TOOLS = [
  { name: "flow-source-sync", description: "Checks and saves changed source files. More.", inputSchema: { type: "object", required: ["project"],
    properties: { project: { type: "string", description: "Project." }, paths: { type: "array" }, dryRun: { type: "boolean" } } } },
  { name: "code-run", description: "Runs a Flow.", inputSchema: { type: "object", properties: { project: { type: "string" }, name: { type: "string" } } } },
  { name: "flow-resource-search", description: "Searches guides.", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
  { name: "echo-secret", description: "Echoes.", inputSchema: { type: "object", properties: {} } },
  { name: "tools-more", description: "The tools outside this list.", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
];
const MORE = [{ name: "scheduler-list", description: "Lists jobs." }];
const MORE_SCHEMA = { "scheduler-list": { type: "object", properties: { project: { type: "string", description: "Project." } } } };

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
  if (name === "flow-resource-get") return { content: [{ type: "text", text: "# Guide " + args.uri + "\nkeys: kept as written" }] };
  if (name === "scheduler-list") return { content: [{ type: "text", text: "OK. keys: ok, jobs. Use structuredContent for data." }],
    structuredContent: { ok: true, jobs: [{ name: "daily", project: args.project }] } };
  if (name === "flow-resource-search") return { content: [{ type: "text", text: "count=1. Use structuredContent for data." }],
    structuredContent: { count: 1, hadProject: "project" in args } };
  if (name === "echo-secret") return { content: [{ type: "text", text: "header was Bearer secret-value" }] };
  if (name === "tools-more") {
    if (!args.name) return { content: [], structuredContent: { ok: true, tools: MORE } };
    if (!args.arguments) return { content: [], structuredContent: { ok: true, tool: { name: args.name, inputSchema: MORE_SCHEMA[args.name] } } };
    return answer(args.name, args.arguments);
  }
  return { isError: true, content: [{ type: "text", text: "Unknown tool" }] };
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      const m = JSON.parse(body);
      calls.push({ url: req.url, headers: req.headers, body: m });
      if (m.params?.arguments?.name === "broken") { res.statusCode = 500; res.end("<html>oops</html>"); return; }
      if (m.params?.arguments?.name === "both") { res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: {}, error: { code: 1 } })); return; }
      const result = m.method === "tools/list" ? { tools: TOOLS } : answer(m.params.name, m.params.arguments);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}/flow`;
});
after(() => server.close());

const freshTmp = () => mkdtempSync(join(tmpdir(), "c8o-tmp-"));
function c8o(args, env = {}) {
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
  assert.deepEqual(last().body.params.arguments, { project: "P", name: "f", input: { a: 1, b: "y", n: 3, flag: true } });
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

test("tools behind tools-more: listed, described and called through tools-more with the project", async () => {
  let r = await c8o(["tools", "jobs"]);
  assert.equal(r.out.trim(), "scheduler-list: Lists jobs.");
  r = await c8o(["tools", "jobs", "--json"]);
  assert.deepEqual(JSON.parse(r.out).map(t => t.name), ["scheduler-list"]);
  r = await c8o(["help", "scheduler-list"]);
  assert.match(r.out, /^ {2}project \(string\): Project\.$/m);
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
