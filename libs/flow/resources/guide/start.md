# Flow MCP Start

Default route for an unknown Flow project:

1. For a simple new Flow, write compact FlowScript first. Do not search/copy existing Flows unless this is maintenance, reuse, or an unclear pattern.
2. Use `flow-requestable-list` and `flow-requestable-schema` when a legacy sequence or transaction shape is needed.
3. Write the working copy with `code-set`, patch it with `code-patch` if needed, then check/run it with `code-check` and `code-run`.
4. Treat it like an editor buffer: use `code-status` to see dirty state, `code-discard` to cancel, and `code-promote` once after diagnostics and runtime behavior are clean.
5. Stop after a successful working-copy run plus promotion unless the user explicitly asked for deployed HTTP validation.
6. Use `flow-search` only when the block/pattern is unknown, with natural tokens such as `GetFeed requestable call sort`. Prefer `project` scope; it also indexes visible `sample_*` Flows from the Flow engine library.
7. Prefer `kind:"sample"` matches only when you need a pattern. Samples are private executable Flows whose name starts with `sample_`.
8. For real DSL examples, read `flow://guide/samples`, then call `code-get` on the named Flow and block samples. Do this before reading broad theory.
9. For FlowScript source, use `code-rg`, then `code-get` and `code-patch`. Address executable Flows with a real Convertigo DBO qname such as `qname:"Project.Flow"`, and project-local blocks with `block:"namespace.name"` plus `project`. Do not encode blocks in `qname`.

Project-local blocks are code-first: `code-set` writes a canonical `.block.js` with `_meta` and either one FlowScript function or one Rhino IIFE. Use Rhino only for Java bridges or low-level primitives; static metadata stays in `_meta`, runtime code is limited to `run(ctx,node)`, and dynamic labels/analysis live in `hooks.file`.

Use `input.*` for Flow or block inputs and `local.*` for scratch data. `flow.*` and `props.*` are not expression scopes. Blocks that load JavaScript helpers with `ctx.lib(...)` must declare them with `uses` so the dependency is visible in the catalog.

For executable Flows with request variables or reusable tests, declare a
top-level `const _flow = { inputs: {...}, tests: {...} }` before the function.
`code-*` tools report these as `inputDefinitions`, `inputVariables`, and
`testCases`; if absent, `inputVariables` are inferred from `input.foo` reads.

For JSON HTTP APIs, use the visible HTTP block: `var response = http.get({ url: "https://..." })`, then read `response.body`; parse `response.text` only when the body is not already native JSON. FlowScript is a Flow block DSL: every block call uses exactly one object parameter, for example `list.filter({ items, where: current.ok })`, `list.sort({ items, by: current.label })`, and `list.map({ items, select: { label: current.label } })`.

Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` when a subtree needs temporary configuration such as an HTTP profile. Root keys are config branches, `then` is reserved for child nodes, and nested objects are deep-merged then restored. Example: `config.use({ http: { timeout: 30000, headers: { Authorization: config.github.token } }, then: function () { var page = http.get({ url: config.github.url }) } })`.

Keep the visible algorithm in FlowScript. A custom Rhino block must not hide an entire backend feature such as fetch + parse + normalize + sort + response. If one primitive is missing, create only that primitive, for example `domain.extractState({ html })`, and keep HTTP, loops, list transforms and result mapping as Flow blocks. Project Rhino blocks are rejected if they perform HTTP or Convertigo requestable calls directly; use `http.get({ url })`/`http.request({ method, url })` and `requestable.call({ requestable })` instead.

Prefer `code-get`, `code-set`, `code-patch`, `code-check`, `code-run`, `code-status`, `code-discard`, `code-promote`, and `code-rg`. `flow-get`/`flow-set` with JSON definitions remain available only when inspecting or debugging the model conversion itself.

In `definition.nodes[]`, node properties are direct fields, for example `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not nest graph fields under `props` or `properties` in a complete definition. `properties` is only an MCP argument for `flow-node-add/edit` when mutating an existing Flow.

When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.

Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls. Discovery tools are paginated by default; keep using `limit` and `cursor` instead of asking for unbounded catalog/tree data.

Avoid shell commands for routine checks. Do not run `git status`, `git diff`, `sed`, `cat`, `pwd`, or HTTP scripts just to confirm a newly generated Flow. If the prompt gives `project` and `qname`, trust them; do not inspect workspace YAML/XML to rediscover them. Use MCP tool results as the source of truth. Do not call `flow-test` after saving when `code-run` already proved the result.

Mutation tools and `flow-block-get` return compact summaries by default. Call `flow-tree` or `flow-get` for focused inspection; pass `detail:"full"` only when debugging the tool response itself or editing block implementation source.

Sample convention for the POC: a sample is a private executable Flow named `sample_*`. `flow-search` returns project samples plus visible library samples. Read real sample sources with `code-get({project:"lib_flow_mcp",qname:"sample_blocks_flow_and_rhino"})` and sample blocks with `code-get({project:"lib_flow_mcp",block:"sample.formatGreeting"})` or `code-get({project:"lib_flow_mcp",block:"sample.sha256"})`. Run executable samples with `code-run` or `flow-test`, inspect with `flow-tree`, then copy the pattern. Samples should show one useful pattern and include comments only for non-obvious choices such as “Only call Flow blocks with one object containing named parameters.” Do not add boilerplate comments that repeat the node label.

Do not call `flow-schema-reset` during normal authoring. Use it only when an existing learned schema is stale and blocks picker/output-schema work.

For diagnostics, MCP responses are sanitized for agents and optional JSONL tracing is enabled with the Convertigo symbol `flow.mcp.traceJsonl` (`true` for the default project `_private/flow-mcp-trace.jsonl`, or a file path). See `flow://guide/tracing`.
