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
let server, url;

const TOOLS = [
  { name: "flow-source-sync", description: "Checks and saves changed source files. More.", inputSchema: { type: "object", required: ["project"],
    properties: { project: { type: "string", description: "Project." }, paths: { type: "array" }, dryRun: { type: "boolean" } } } },
  { name: "code-run", description: "Runs a Flow.", inputSchema: { type: "object", properties: { project: { type: "string" }, name: { type: "string" } } } },
  { name: "flow-catalog", description: "Lists blocks.", inputSchema: { type: "object", properties: { query: { type: "string" } } } },
  { name: "scheduler-list", description: "Lists jobs.", inputSchema: { type: "object", properties: { project: { type: "string" } } } },
];

const REFUSED = {
  isError: true,
  content: [{ type: "text", text: "Error [FLOWSCRIPT_VALIDATION_FAILED]: FlowScript validation failed at line 7. See structuredContent.error." },
    { type: "text", text: "_flow/flows/a.flow.js: Not saved." }, { type: "text", text: "1 checked, 1 applied, 1 refused." }],
  structuredContent: { ok: false, dryRun: false, summary: { checked: 2, applied: 1, refused: 1, rewritten: 1 }, next: "Fix the refused files.",
    results: [
      { path: "_flow/blocks/app/x.block.js", type: "block", applied: true, rewritten: true, note: "The engine normalized this file when saving it: read it again before editing it.",
        response: { result: { content: [{ type: "text", text: "OK. app.x. keys: ok, name. Use structuredContent for data." }],
          structuredContent: { ok: true, warnings: ["Move structural endpoints to config."] } } } },
      { path: "_flow/flows/a.flow.js", type: "flow", note: "Not saved.",
        response: { result: { isError: true, content: [{ type: "text", text: "Error [FLOWSCRIPT_VALIDATION_FAILED]: at line 7" }],
          structuredContent: { ok: false, error: { diagnostics: [{ severity: "error", code: "INVALID_EXPRESSION", line: 7, block: "if",
            property: "condition", message: "Unknown expression function: date.add", expression: "!date.add({})",
            hint: "Call date.add on its own line." }] } } } } } ] },
};

function answer(name, args) {
  if (name === "flow-source-sync") {
    if (args.dryRun) return { content: [{ type: "text", text: "No changed source since the last sync." }],
      structuredContent: { ok: true, dryRun: true, results: [], summary: { checked: 0, applied: 0, refused: 0, rewritten: 0 } } };
    return REFUSED;
  }
  if (name === "code-run") return { content: [{ type: "text", text: "OK. keys: ok, result, qname. Use structuredContent for data." }],
    structuredContent: { ok: true, qname: "P.f", revision: "abc", result: { echo: args.input }, accessibilityNote: "f is public." } };
  if (name === "frontend-svelte-action") return { content: [{ type: "text", text: "OK. keys: ok, openUrl. Use structuredContent for data." }],
    structuredContent: { ok: true, openUrl: "http://127.0.0.1:1/app/", status: "ready" } };
  if (name === "flow-resource-get") return { content: [{ type: "text", text: "# Guide " + args.uri }] };
  if (name === "scheduler-list") return { content: [{ type: "text", text: "OK. keys: ok, jobs. Use structuredContent for data." }],
    structuredContent: { ok: true, jobs: [{ name: "daily", project: args.project }] } };
  if (name === "flow-catalog") return { content: [{ type: "text", text: "count=1. 1 blocks: date.diff. Use structuredContent for data." }],
    structuredContent: { count: 1, blocks: [{ name: "date.diff" }], hadProject: "project" in args } };
  return { isError: true, content: [{ type: "text", text: "Unknown tool" }] };
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      const m = JSON.parse(body);
      calls.push({ url: req.url, headers: req.headers, body: m });
      const result = m.method === "tools/list" ? { tools: TOOLS } : answer(m.params.name, m.params.arguments);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }));
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}/flow`;
});
after(() => server.close());

function c8o(args, env = {}) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [C8O, ...args], { env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), "c8o-home-")),
      TMPDIR: mkdtempSync(join(tmpdir(), "c8o-tmp-")), C8O_URL: url, C8O_PROJECT: "P", C8O_CONFIG: "/nonexistent", ...env } });
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
});

test("sync: refused file with file:line diagnostics, no envelope noise, exit 1", async () => {
  const r = await c8o(["sync"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /^_flow\/flows\/a\.flow\.js:7: error INVALID_EXPRESSION \(if\.condition\): Unknown expression function: date\.add$/m);
  assert.match(r.out, /^ {2}fix: Call date\.add on its own line\.$/m);
  assert.match(r.out, /^_flow\/blocks\/app\/x\.block\.js: saved, normalized by the engine: read it again \(block\)$/m);
  assert.match(r.out, /warning: Move structural endpoints to config\./);
  assert.match(r.out, /2 checked, 1 saved, 1 refused, 1 normalized\./);
  assert.doesNotMatch(r.out, /structuredContent|keys: ok/);
  const b = last().body;
  assert.equal(b.params.name, "flow-source-sync");
  assert.deepEqual(b.params.arguments, { project: "P", dryRun: false });
  assert.equal(last().headers["x-convertigo-source-mode"], "sources");
  assert.equal(last().headers.authorization, undefined);
  assert.match(last().url, /^\/flow\?jsonOnly=true$/);
});

test("check: dry run with normalized paths", async () => {
  const r = await c8o(["check", "./_flow/flows/a.flow.js", "/project/_flow/data/model.yaml", "--gateway"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /No changed source since the last sync\./);
  assert.deepEqual(last().body.params.arguments,
    { project: "P", dryRun: true, paths: ["_flow/flows/a.flow.js", "_flow/data/model.yaml"], gateway: true });
});

test("run: input from --input, k=v and k:=json; result printed as JSON", async () => {
  const r = await c8o(["run", "f", "--input", '{"a":1,"b":"x"}', "b=y", "n:=3", "flag:=true"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments, { project: "P", name: "f", input: { a: 1, b: "y", n: 3, flag: true } });
  assert.deepEqual(JSON.parse(r.out.split("\naccessibilityNote")[0]), { echo: { a: 1, b: "y", n: 3, flag: true } });
  assert.match(r.out, /^accessibilityNote: f is public\.$/m);
  assert.doesNotMatch(r.out, /revision|keys: ok/);
});

test("view prints the viewer URL first", async () => {
  const r = await c8o(["view"]);
  assert.equal(r.out.split("\n")[0], "http://127.0.0.1:1/app/");
  assert.deepEqual(last().body.params.arguments, { project: "P", actionId: "dev.sync" });
});

test("guide: a file path of the guide folder is read as its flow://guide URI", async () => {
  const r = await c8o(["guide", "/c8o/guide/entities/model.md"]);
  assert.equal(r.out.trim(), "# Guide flow://guide/entities/model");
  await c8o(["guide"]);
  assert.equal(last().body.params.arguments.uri, "flow://guide/start");
});

test("passthrough: project added only when the tool takes one", async () => {
  let r = await c8o(["scheduler-list"]);
  assert.equal(r.code, 0);
  assert.deepEqual(last().body.params.arguments, { project: "P" });
  assert.match(r.out, /"name": "daily"/);
  r = await c8o(["flow-catalog", "query=date", "--json"]);
  assert.deepEqual(last().body.params.arguments, { query: "date" });
  assert.equal(JSON.parse(r.out).hadProject, false);
  r = await c8o(["code-set", "x=1"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /Unknown command or tool: code-set/);
});

test("tools and help read the tool list", async () => {
  let r = await c8o(["tools", "sync"]);
  assert.equal(r.out.trim(), "flow-source-sync: Checks and saves changed source files.");
  r = await c8o(["help", "flow-source-sync"]);
  assert.match(r.out, /^ {2}project \(string, required\): Project\.$/m);
});

test("token file: sent as a bearer header, never printed", async () => {
  const f = join(mkdtempSync(join(tmpdir(), "c8o-tok-")), "token");
  writeFileSync(f, "secret-value\n");
  const r = await c8o(["view"], { C8O_TOKEN_FILE: f });
  assert.equal(last().headers.authorization, "Bearer secret-value");
  assert.doesNotMatch(r.out + r.err, /secret-value/);
});

test("connection refused: exit 2 with a short message", async () => {
  const r = await c8o(["view"], { C8O_URL: "http://127.0.0.1:9/flow" });
  assert.equal(r.code, 2);
  assert.match(r.err, /^c8o: Cannot reach the engine/);
});
