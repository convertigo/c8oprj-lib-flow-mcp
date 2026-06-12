# Flow Authoring Cycle

Create or modify a Flow sidecar with the smallest loop that proves behavior:

- `flow-list` only to enumerate known Flow names.
- `flow-search` to locate samples, nodes, schemas, block docs or existing examples only when the block or pattern is unclear. Project search also includes visible library samples.
- Prefer `kind:"sample"` matches only when you need a pattern. A sample is a private executable Flow named `sample_*`, meant to be copied as a pattern.
- Avoid `flow-catalog` when a sample exists. `flow-catalog` defaults to typed signatures; use `flow-block-get` only for one unclear block.
- `flow-context` at the target node to know `request`, `input`, `config`, `local`, `current` and `result` paths. Use `include:["local","current"]` when you only need those roots.
- `flow-analyze` is static data-flow analysis, close to a schema manager view: node order, reads, writes, sources and inferred scope paths. It is compact by default; use `detail:"full"` only when schema details are needed.
- For a new Flow, write compact FlowScript first with `flow-code-set`, patch the working copy with `flow-code-patch`, check it with `flow-code-check`, run it with `flow-code-run`, then call `flow-code-promote` once after diagnostics and runtime behavior are clean. Use `flow-code-status` when you need dirty/revision state and `flow-code-discard` to cancel the buffer. Do not pass `saveProject:true`, `refresh:true`, `draft`, or `dry` unless the user explicitly asks for low-level debugging.
- Use raw `definition.nodes[]` only when debugging the compiler/model conversion. In that shape, node properties are direct fields: `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not use nested `props` or `properties` there.
- Flow expressions are null-safe and support index reads such as `local.items[0]` or `current["media:thumbnail"]`. JavaScript array/object literals are still not expression syntax; use literal properties or `json.object/json.field`.
- Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` for temporary scoped config. Root keys are config branches, `then` is the reserved child slot, and overrides are deep-merged only while the slot runs.
- Use top-level `const _flow = { inputs: {...}, tests: {...} }` for request inputs, descriptions, defaults, and reusable test inputs. If omitted, `flow-code-*` tools infer `inputVariables` from `input.foo` reads, but human-facing labels/comments are unavailable.
- For broad edits, use `flow-code-get`, patch the returned code, then send it back through `flow-code-patch` with the returned `revision`.
- `flow-tree` is compact by default through MCP. Use `detail:"full"` only when a UI-like tree with full `definition` and `info` strings is really needed.
- Prefer FlowScript patching for normal maintenance. Use `flow-node-add/edit/move/delete/duplicate` only for low-level model operations or UI-like tooling.
- Node mutation tools use `properties` for node properties. That is an MCP tool argument, not the Flow definition shape. Do not send `props`.
- For source resources (`libs/flow/blocks`, `libs/flow/types`, type editors), use search/get/patch instead of replacing whole files.
- Custom Rhino blocks are for missing low-level primitives only. They must not do HTTP or Convertigo requestable calls directly; use visible `http.get`/`http.request` and `requestable.call` nodes.
- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.
- Mutation tools and `flow-block-get` return compact responses by default. Use `detail:"full"` only when debugging the response or editing source; otherwise inspect with `flow-tree`.
- With a live `project`, named write tools register/save the Flow DBO and refresh Studio by default. This makes the Flow callable through normal `?__sequence=Name` execution.
- `flow-test` with realistic input and `includeTrace:true` only while debugging. Avoid `includeFlow`, `includeFullResult` and `includeFullTrace` during normal authoring.
- Do not use `flow-schema-reset` unless an old learned schema is clearly stale.

After `flow-code-run` has proved the requested result and `flow-code-promote`
succeeds, stop. Avoid shell commands such as `git status`, `git diff`, `sed`,
`cat`, `pwd`, `flow-test`, or ad hoc HTTP scripts for routine confirmation.
If the prompt gives `project` and `qname`, trust them; do not inspect workspace
YAML/XML to rediscover them.

Do not read every Flow sidecar up front. Search first, then open the narrow target.

For reusable examples, create a private executable Flow named `sample_*`. Keep comments didactic: explain subtle syntax or design choices, not what the node label already says.
