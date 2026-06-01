# Flow MCP Start

Default route for an unknown Flow project:

1. Call `flow-search` first with natural tokens, for example `GetFeed requestable call`. Prefer `project` scope; use `scope:"workspace"` only for discovery across loaded Studio projects.
2. Inspect only useful matches with `flow-tree` or `flow-get`; do not read the whole catalog when a matching Flow exists.
3. Call `flow-context` before writing expressions or templates.
4. Edit with `flow-edit`, then validate with `flow-test` or `flow-output-schema`.
5. For custom block/composite block/fragment/type/editor/library source code, use `flow-resource-search`, `flow-resource-get`, then `flow-resource-patch` with `baseHash`.

`flow-get` returns both YAML `source` and a JSON `definition`. `flow-set`, `flow-run`, `flow-test`, `flow-tree` and `flow-apply` accept that same `definition` shape, so an agent may get, modify and set without rewriting YAML by hand.

When a live `project` is provided, `flow-set` and `flow-edit` register/save the Flow DBO by default so it is callable as a requestable. Use `register:false` only for sidecar-only tests.

Keep responses small: after reading this guide, pass `doc:false,hints:false` on repeated tool calls.
