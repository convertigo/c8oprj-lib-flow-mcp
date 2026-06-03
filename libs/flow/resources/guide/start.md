# Flow MCP Start

Default route for an unknown Flow project:

1. Call `flow-search` first with natural tokens, for example `GetFeed requestable call`. Prefer `project` scope; use `scope:"workspace"` only for discovery across loaded Studio projects.
2. Inspect only useful matches with `flow-tree` or `flow-get`; do not read the whole catalog when a matching Flow exists.
3. For a new Flow, build a small `definition`, prove it with `flow-block-test`, then write it once with `flow-set`; avoid incremental `flow-node-add` unless you are editing an existing Flow.
4. Call `flow-context` before writing expressions or templates.
5. Edit existing Flows with targeted `flow-node-*` or `flow-edit`, then validate with `flow-test` or `flow-output-schema`.
6. For custom block/composite block/fragment/type/editor/library source code, use `flow-resource-search`, `flow-resource-get`, then `flow-resource-patch` with `baseHash`.

Custom Rhino blocks are descriptor-first: static metadata is in `*.block.yaml`, runtime code is limited to `run(ctx,node)` in `*.js`, and dynamic labels/analysis live in `hooks.file`.

Use `input.*` for Flow or block inputs and `local.*` for scratch data. `flow.*` and `props.*` are not expression scopes. Blocks that load JavaScript helpers with `ctx.lib(...)` must declare them with `uses` so the dependency is visible in the catalog.

`flow-get` returns both YAML `source` and a JSON `definition`. `flow-set`, `flow-run`, `flow-test`, `flow-tree` and `flow-apply` accept that same `definition` shape, so an agent may get, modify and set without rewriting YAML by hand.

In `definition.nodes[]`, node properties are direct fields, for example `{id:"call", block:"requestable.call", requestable:".GetFeed", out:"local.feed"}`. Do not nest graph fields under `props` or `properties` in a complete definition. `properties` is only an MCP argument for `flow-node-add/edit` when mutating an existing Flow.

When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.

Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls. Discovery tools are paginated by default; keep using `limit` and `cursor` instead of asking for unbounded catalog/tree data.

Mutation tools and `flow-block-get` return compact summaries by default. Call `flow-tree` or `flow-get` for focused inspection; pass `detail:"full"` only when debugging the tool response itself or editing block implementation source.

Do not call `flow-schema-reset` during normal authoring. Use it only when an existing learned schema is stale and blocks picker/output-schema work.

For diagnostics, MCP responses are sanitized for agents and optional JSONL tracing is enabled with the Convertigo symbol `flow.mcp.traceJsonl` (`true` for the default project `_private/flow-mcp-trace.jsonl`, or a file path). See `flow://guide/tracing`.
