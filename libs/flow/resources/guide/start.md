# Flow MCP Start

Default route for Flow authoring:

1. For a simple new Flow, learn syntax from small samples, then write compact FlowScript first. FlowScript is strict: every block call is `block.name({ key: value })` with one object argument. Do not search/copy existing application Flows unless this is maintenance, reuse, or an unclear pattern.
   If the requested `project`, `qname`, or `block` is not accessible through Flow MCP, stop and report that blocker. Do not use legacy MCP project discovery, and do not create the Flow in another project.
2. In a fresh context, read the MCP resource `flow://guide/samples` with `resources/read`, then call the exact `code-get` examples listed there. Use them only to learn syntax: one block call, one object of named parameters, local variables, and `result.*` output. Do not pass `flow://...` URIs to `code-get`.
3. After that syntax warm-up, start coding directly with `code-set` in the strict DSL. Do not browse the full catalog first; let `code-set`, `code-check` and `code-run` diagnostics suggest block names, properties and signatures.
4. Use `flow-requestable-list` and `flow-requestable-schema` only when a legacy sequence or transaction shape is needed.
5. Write the working copy with `code-set`, patch it with `code-patch` if needed, then check/run it with `code-check` and `code-run`.
6. Treat it like an editor buffer: use `code-status` to see dirty state, `code-discard` to cancel, and `code-promote` once after diagnostics and runtime behavior are clean. If `code-run` returns `unsaved:true` or `workingCopy:true`, call `code-promote` before stopping.
7. Stop after a successful working-copy run plus promotion unless the user explicitly asked for deployed HTTP validation.
8. Use `flow-search` only after the first draft when the block/pattern is still unknown, with natural tokens such as `GetFeed requestable call sort`. Prefer `project` scope; it also indexes visible `sample_*` Flows from the Flow engine library.
9. Prefer `kind:"sample"` matches only when you need a pattern. Samples are private executable Flows whose name starts with `sample_`.
10. For FlowScript source, use `code-get({ pattern:"..." })` or `code-rg` for extracts, then `code-get` and `code-patch` for edits. Address executable Flows with a real Convertigo DBO qname such as `qname:"Project.Flow"`, and project-local blocks with `block:"namespace.name"` plus `project`. Do not encode blocks in `qname`.

Project-local blocks are code-first: `code-set` writes a canonical `.block.js` with `_meta` and either one FlowScript function or one Rhino IIFE. Use Rhino only for Java bridges or low-level primitives; static metadata stays in `_meta`, runtime code is limited to `run(ctx,node)`, and dynamic labels/analysis live in `hooks.file`.

When creating a Rhino primitive, read `flow://guide/rhino-block-api` first instead of searching files on disk for `ctx.*` examples.

Use `input.*` for Flow or block inputs and `local.*` for scratch data. `flow.*` and `props.*` are not expression scopes. Blocks that load JavaScript helpers with `ctx.lib(...)` must declare them with `uses` so the dependency is visible in the catalog.

For executable Flows with request variables or reusable tests, declare a
top-level `const _flow = { inputs: {...}, tests: {...} }` before the function.
`code-*` tools report these as `inputDefinitions`, `inputVariables`, and
`testCases`. Explicit inputs are synchronized to Convertigo request variables so
Studio and SDK callers see the same contract; if absent, `inputVariables` are
inferred from `input.foo` reads and authoring diagnostics ask for declarations.

For executable Flow outputs, use `flow-output-schema({ project, qname })`.
It combines explicit result contracts, static analysis of `result.*` writes and
learned runtime result schemas. If a requestable schema is partial but
`code-run` returns the right fields, rerun `code-run`, then inspect
`flow-output-schema` before editing any block. Use `flow-schema-reset` only for
stale learned schemas.
Pass `detail:"full"` to compare declared/static/learned/effective sources and
warnings. For a single producer, use
`flow-node-output-schema({ project, qname, nodeId, detail:"full" })`, especially
after HTTP/exec/parser blocks learn a runtime schema. If `nodeId` is ambiguous,
pass the JSON Pointer `path` returned by `flow-search` as `nodePointer`.
To keep a verified producer schema, call
`flow-node-output-schema({ project, qname, nodeId, action:"adopt",
source:"learned" })`, `source:"static"`, or pass `schema:{...}`. Use
`action:"remove"` to drop that node schema and resume inference.
An explicit result contract is optional `_flow.outputs`. If it is absent,
static and learned schemas infer the result. If a verified static or learned
schema should become the contract, call
`flow-output-schema({ project, qname, action:"adopt", source:"static" })` or
`source:"learned"`. To remove that contract and resume inference, call
`flow-output-schema({ project, qname, action:"remove" })`.
To delete stale learned result samples without touching `_flow.outputs`, call
`flow-output-schema({ project, qname, action:"reset" })`.
If `detail:"full"` shows `learned` fields that no longer exist in current code,
or `unknown` array items from old/empty runtime samples, reset that learned
schema instead of adopting it. Prefer `flow-node-output-schema action:"remove"`
for one producer; use `flow-schema-reset({ project, flowName })` for a stale
Flow-level learned schema.
After editing shared Flow engine JavaScript (`Engine.js`, modules, blocks or
hooks), call `flow-cache-clear({ project })` to force the next MCP/Studio call to
use a fresh bridge runtime without restarting the whole Convertigo engine.

For JSON HTTP APIs, use the visible HTTP block: `var response = http.get({ url: "https://..." })`, then read `response.body`; parse `response.text` only when the body is not already native JSON. FlowScript is a Flow block DSL: every block call uses exactly one object parameter, for example `list.filter({ items, where: current.ok })`, `list.sort({ items, by: current.label })`, and `list.map({ items, select: { label: current.label } })`. Positional JavaScript-style calls such as `http.get(url)`, `list.sort(items, by)`, or `requestable.call(".GetFeed")` are invalid; diagnostics show the accepted object keys.

For array projections, assign the mapping to a variable and then copy it to the response: `var rows = list.map({ items, select: { label: current.label } }); result.rows = rows`. Do not hard-code fixed indexes such as `rows[0]`, `rows[1]` for a dynamic list.

Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` when a subtree needs temporary configuration such as an HTTP profile. Root keys are config branches, `then` is reserved for child nodes, and nested objects are deep-merged then restored. Example: `config.use({ http: { timeout: 30000, headers: { Authorization: config.github.token } }, then: function () { var page = http.get({ url: config.github.url }) } })`.

Keep the visible algorithm in FlowScript. A custom Rhino block must not hide an entire backend feature such as fetch + parse + normalize + sort + response. If one primitive is missing, create only that primitive, for example `domain.extractState({ html })`, and keep HTTP, loops, list transforms and result mapping as Flow blocks. Project Rhino blocks are rejected if they perform HTTP or Convertigo requestable calls directly; use `http.get({ url })`/`http.request({ method, url })` and `requestable.call({ requestable })` instead.

Prefer `code-get`, `code-set`, `code-patch`, `code-check`, `code-run`, `code-status`, `code-discard`, `code-promote`, and `code-rg`. `flow-get`/`flow-set` with JSON definitions remain available only when inspecting or debugging the model conversion itself.

In `definition.nodes[]`, node properties are direct fields, for example `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not nest graph fields under `props` or `properties` in a complete definition. `properties` is only an MCP argument for `flow-node-add/edit` when mutating an existing Flow.

When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.

Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls. Discovery tools are paginated by default; keep using `limit` and `cursor` instead of asking for unbounded catalog/tree data.

Avoid shell commands for routine checks. Do not run `git status`, `git diff`, `sed`, `cat`, `pwd`, or HTTP scripts just to confirm a newly generated Flow. If the prompt gives `project` and `qname`, trust them; do not inspect workspace YAML/XML to rediscover them. Use MCP tool results as the source of truth. Do not call `flow-test` after saving when `code-run` already proved the result.

Mutation tools and `flow-block-get` return compact summaries by default. Call `flow-tree` or `flow-get` for focused inspection; pass `detail:"full"` only when debugging the tool response itself or editing block implementation source.

Sample convention for the POC: a sample is a private executable Flow named `sample_*`. `flow-search` returns project samples plus visible library samples. Read real sample sources with `code-get({project:"lib_flow_mcp",qname:"sample_blocks_flow_and_rhino"})` and sample blocks with `code-get({project:"lib_flow_mcp",block:"sample.formatGreeting"})` or `code-get({project:"lib_flow_mcp",block:"sample.sha256"})`. Run executable samples with `code-run` or `flow-test`, inspect with `flow-tree`, then copy the pattern. Samples should show one useful pattern and include comments only for non-obvious choices such as “Only call Flow blocks with one object containing named parameters.” Do not add boilerplate comments that repeat the node label.

Do not call `flow-schema-reset` during normal authoring. Prefer
`flow-node-output-schema action:"remove"` for one producer; use
`flow-schema-reset` only when an existing learned schema is stale and blocks
picker/output-schema work across broader scope.

For diagnostics, MCP responses are sanitized for agents and optional JSONL tracing is enabled with the Convertigo symbol `flow.mcp.traceJsonl` (`true` for the default project `_private/flow-mcp-trace.jsonl`, or a file path). See `flow://guide/tracing`.
