# Flow Authoring Cycle

Create or modify a Flow sidecar with the smallest loop that proves behavior:

- `flow-list` only to enumerate known Flow names.
- `flow-search` to locate nodes, schemas, block docs or existing examples. Multi-word queries match unordered tokens, like a small `rg`.
- Avoid `flow-catalog detail:"compact"` when an example exists. Use `flow-block-get` for one unknown block, and `flow-catalog` summary only to discover names.
- `flow-context` at the target node to know `request`, `input`, `config`, `local`, `current` and `result` paths. Use `include:["local","current"]` when you only need those roots.
- `flow-analyze` is static data-flow analysis, close to a schema manager view: node order, reads, writes, sources and inferred scope paths. It is compact by default; use `detail:"full"` only when schema details are needed.
- For a new Flow, build and test a complete `definition` with `flow-block-test`, then call `flow-set` once. This is usually cheaper and safer than adding nodes one by one.
- In complete `definition.nodes[]`, write node properties as direct fields: `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not use nested `props` or `properties` there.
- For broad edits, use `flow-get.definition`, modify that object, then send it back through `flow-set`.
- `flow-tree` is compact by default through MCP. Use `detail:"full"` only when a UI-like tree with full `definition` and `info` strings is really needed.
- Prefer `flow-node-add/edit/move/delete/duplicate` for common node operations on an existing Flow.
- Node mutation tools use `properties` for node properties. That is an MCP tool argument, not the Flow definition shape. Do not send `props`.
- For source resources (`libs/flow/blocks`, `libs/flow/types`, type editors), use search/get/patch instead of replacing whole files.
- Use `flow-edit` for lower-level mutations; use `dryRun:true` when unsure.
- Mutation tools and `flow-block-get` return compact responses by default. Use `detail:"full"` only when debugging the response or editing source; otherwise inspect with `flow-tree`.
- With a live `project`, named write tools register/save the Flow DBO and refresh Studio by default. This makes the Flow callable through normal `?__sequence=Name` execution.
- `flow-test` with realistic input and `includeTrace:true` only while debugging. Avoid `includeFlow`, `includeFullResult` and `includeFullTrace` during normal authoring.
- Do not use `flow-schema-reset` unless an old learned schema is clearly stale.

Do not read every Flow sidecar up front. Search first, then open the narrow target.
