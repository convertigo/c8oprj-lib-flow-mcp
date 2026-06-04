# Flow MCP Start

Default route for an unknown Flow project:

1. Call `flow-search` first with natural tokens, for example `GetFeed requestable call sort`. Prefer `project` scope; it also indexes visible `sample_*` Flows from the Flow engine library. Use `scope:"workspace"` only for discovery across loaded Studio projects.
2. Prefer `kind:"sample"` matches even when only part of the query matched: samples are private executable Flows whose name starts with `sample_`. Open them with `flow-tree`, copy the pattern, then adapt it.
3. Inspect only useful matches with `flow-tree` or `flow-get`; do not read the whole catalog when a matching sample or Flow exists.
4. For a new Flow, build a small `definition`, preview it with `flow-block-test`, then write it once with `flow-set`; avoid incremental `flow-node-add` unless you are editing an existing Flow.
5. Call `flow-context` before writing expressions or templates.
6. Edit existing Flows with targeted `flow-node-*` or `flow-edit`, then validate with `flow-test` or `flow-output-schema`.
7. For custom block/composite block/fragment/type/editor/library source code, use `flow-resource-search`, `flow-resource-get`, then `flow-resource-patch` with `baseHash`.

Custom Rhino blocks are descriptor-first: static metadata is in `*.block.yaml`, runtime code is limited to `run(ctx,node)` in `*.js`, and dynamic labels/analysis live in `hooks.file`.

Use `input.*` for Flow or block inputs and `local.*` for scratch data. `flow.*` and `props.*` are not expression scopes. Blocks that load JavaScript helpers with `ctx.lib(...)` must declare them with `uses` so the dependency is visible in the catalog.

`flow-get` returns both YAML `source` and a JSON `definition`. `flow-set`, `flow-run`, `flow-test`, `flow-tree` and `flow-apply` accept that same `definition` shape, so an agent may get, modify and set without rewriting YAML by hand.

In `definition.nodes[]`, node properties are direct fields, for example `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not nest graph fields under `props` or `properties` in a complete definition. `properties` is only an MCP argument for `flow-node-add/edit` when mutating an existing Flow.

When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.

Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls. Discovery tools are paginated by default; keep using `limit` and `cursor` instead of asking for unbounded catalog/tree data.

Mutation tools and `flow-block-get` return compact summaries by default. Call `flow-tree` or `flow-get` for focused inspection; pass `detail:"full"` only when debugging the tool response itself or editing block implementation source.

Sample convention for the POC: a sample is a private executable Flow named `sample_*`. `flow-search` returns project samples plus visible library samples. Run it with `flow-test project:"provider" name:"sample_..."`, inspect it with `flow-tree`, then copy the pattern. It should show one useful pattern and include comments only for non-obvious choices such as “use this syntax because ...”. Do not add boilerplate comments that repeat the node label.

Do not call `flow-schema-reset` during normal authoring. Use it only when an existing learned schema is stale and blocks picker/output-schema work.

For diagnostics, MCP responses are sanitized for agents and optional JSONL tracing is enabled with the Convertigo symbol `flow.mcp.traceJsonl` (`true` for the default project `_private/flow-mcp-trace.jsonl`, or a file path). See `flow://guide/tracing`.
