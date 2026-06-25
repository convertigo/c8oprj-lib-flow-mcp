# Flow Authoring Cycle

Create or modify a Flow sidecar with the smallest loop that proves behavior:

- If the user gives a `project`, `qname`, or `block`, that is the target contract. If Flow MCP cannot access it, stop and report the exact blocker instead of falling back to another project or to legacy MCP project discovery.
- For a new Flow, start with the syntax warm-up: read the MCP resource
  `flow://guide/samples` with `resources/read` and the exact `code-get`
  examples listed there, then write the first FlowScript draft with
  `code-set`. Do not pass `flow://...` URIs to `code-get`.
- `flow-list` only to enumerate known Flow names during maintenance, not during fresh authoring.
- `flow-search` to locate samples, nodes, schemas, block docs or existing examples only after the first draft when the block or pattern is unclear. Project search also includes visible library samples.
- Prefer `kind:"sample"` matches only when you need a pattern. A sample is a private executable Flow named `sample_*`, meant to teach syntax and style, not to replace first-principles authoring.
- Read `flow://guide/samples` for concrete FlowScript examples. Prefer `code-get({project:"lib_flow_mcp",qname:"sample_blocks_flow_and_rhino"})`, `code-get({project:"lib_flow_engine",qname:"sample_list_filter_sort_map"})`, and `code-get({project:"lib_flow_mcp",block:"sample.formatGreeting"})` over rereading general syntax rules.
- Avoid `flow-catalog` when a sample exists. `flow-catalog` defaults to typed signatures; use `flow-block-get` only for one unclear block.
- `flow-context` at the target node to know `request`, `input`, `config`, `local`, `current` and `result` paths. Use `include:["local","current"]` when you only need those roots.
- `flow-analyze` is static data-flow analysis, close to a schema manager view: node order, reads, writes, sources and inferred scope paths. It is compact by default; use `detail:"full"` only when schema details are needed.
- For a new Flow, write compact FlowScript first with `code-set`, patch the working copy with `code-patch`, check it with `code-check`, run it with `code-run`, then call `code-promote` once after diagnostics and runtime behavior are clean. If `code-run` returns `unsaved:true` or `workingCopy:true`, the Flow is still a draft: call `code-promote` before stopping. Use `code-status` when you need dirty/revision state and `code-discard` to cancel the buffer. Do not pass `saveProject:true`, `refresh:true`, `draft`, or `dry` unless the user explicitly asks for low-level debugging.
- Use raw `definition.nodes[]` only when debugging the compiler/model conversion. In that shape, node properties are direct fields: `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not use nested `props` or `properties` there.
- Flow expressions are null-safe and support index reads such as `local.items[0]` or `current["media:thumbnail"]`. Expression arrays/objects can contain scope expressions, for example `args: [command]` or `select: { title: current.title }`.
- For array projections, prefer `var mapped = list.map({ items, select: {
  field: current.field } }); result.mapped = mapped`. Do not hard-code
  `items[0]`, `items[1]`, etc. for dynamic lists.
- Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` for temporary scoped config. Root keys are config branches, `then` is the reserved child slot, and overrides are deep-merged only while the slot runs.
- Use top-level `const _flow = { inputs: {...}, tests: {...} }` for request inputs, descriptions, defaults, and reusable test inputs. If omitted, `code-*` tools infer `inputVariables` from `input.foo` reads, but human-facing labels/comments are unavailable.
- Use `flow-output-schema({ project, qname })` to verify executable Flow
  outputs. It combines explicit contracts, static analysis of `result.*` writes
  and optional learned result schemas. Ordinary `code-run` or requestable
  execution does not learn the final Flow result unless an explicit record/learn
  flag is used. If a requestable schema is partial after a good run, inspect
  `detail:"full"` warnings and the producer nodes before changing block schemas;
  use `flow-schema-reset` only for stale learned schemas.
- Use `flow-output-schema({ project, qname, detail:"full" })` before adopting
  a contract when you need declared/static/learned/effective sources and
  warnings. Use `flow-node-output-schema({ project, qname, nodeId,
  detail:"full" })` for one producer node, especially HTTP/exec/parser blocks
  with generic declared output and richer learned output. If `nodeId` is
  ambiguous, pass the JSON Pointer `path` returned by `flow-search` as
  `nodePointer`. Use `action:"adopt"` with `source:"learned"`, `source:"static"`
  or `schema:{...}` to keep a verified node schema; use `action:"remove"` to
  resume inference for that node output.
- If `learned` contains fields no longer produced by current code, or `unknown`
  array items from old/empty runtime samples, treat it as stale. Use
  `flow-schema-reset({ project, flowName })` for Flow-level stale learned
  schemas; use `flow-node-output-schema action:"remove"` for one producer.
- `_flow.outputs` is optional. If present, it is the explicit Flow result
  contract used by requestable schemas and pickers; if absent, inference still
  works and remains dynamic as new `result.*` writes are added. After a verified
  run and `detail:"full"` review, use `flow-output-schema({ project, qname,
  action:"adopt", source:"static"|"learned" })` to write `_flow.outputs`, or
  `flow-output-schema({ project, qname, action:"remove" })` to delete it.
  Use `flow-output-schema({ project, qname, action:"reset" })` to delete stale
  learned result samples without touching `_flow.outputs`.
- Before writing a Rhino primitive, read `flow://guide/rhino-block-api`.
  It documents `ctx.props`, `ctx.template`, `ctx.expr`, `ctx.read`,
  `ctx.write`, `ctx.callBlock`, `ctx.throwFlow` and `ctx.lib` so agents do not
  need shell `rg` over Flow engine sources.
- For broad edits, use `code-get`, patch the returned code, then send it back through `code-patch` with the returned `revision`. For narrow reads, `code-get({ pattern:"..." })` returns extracts like `code-rg`; omit `pattern` only when the full source is needed.
- `flow-tree` is compact by default through MCP. Use `detail:"full"` only when a UI-like tree with full `definition` and `info` strings is really needed.
- Prefer FlowScript patching for normal maintenance. Use `flow-node-add/edit/move/delete/duplicate` only for low-level model operations or UI-like tooling.
- Node mutation tools use `properties` for node properties. That is an MCP tool argument, not the Flow definition shape. Do not send `props`.
- For source resources (`libs/flow/blocks`, `libs/flow/types`, type editors), use search/get/patch instead of replacing whole files.
- Custom Rhino blocks are for missing low-level primitives only. They must not do HTTP or Convertigo requestable calls directly; use visible `http.get`/`http.request` and `requestable.call` nodes.
- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.
- Mutation tools and `flow-block-get` return compact responses by default. Use `detail:"full"` only when debugging the response or editing source; otherwise inspect with `flow-tree`.
- With a live `project`, named write tools register/save the Flow DBO and refresh Studio by default. This makes the Flow callable through normal `?__sequence=Name` execution.
- `flow-test` with realistic input and `includeTrace:true` only while debugging. Avoid `includeFlow`, `includeFullResult` and `includeFullTrace` during normal authoring.
- Do not use `flow-schema-reset` unless an old learned schema is clearly stale
  across broader scope. Prefer `flow-node-output-schema action:"remove"` for one
  producer node.

After `code-run` has proved the requested result and `code-promote`
succeeds, stop. Avoid shell commands such as `git status`, `git diff`, `sed`,
`cat`, `pwd`, `flow-test`, or ad hoc HTTP scripts for routine confirmation.
If the prompt gives `project` and `qname`, trust them; do not inspect workspace
YAML/XML to rediscover them.

Do not read every Flow sidecar up front. Search first, then open the narrow target.

For reusable examples, create a private executable Flow named `sample_*`. Keep comments didactic: explain subtle syntax or design choices, not what the node label already says. Good comments look like `// Only call Flow blocks with one object containing named parameters.` Rhino sample blocks should start with `// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.
