# Flow MCP Authoring Guide

This project is the Flow-native MCP server. Keep it separate from
`lib_flow_engine`.

Rules:

- Do not add general runtime blocks here; put them in `lib_flow_engine`.
- Put MCP protocol routing, Flow authoring tools and agent-only helpers here.
- Prefer a small MCP tool that calls reusable blocks with `ctx.callBlock(...)`
  over a large block that duplicates engine logic. Promote reusable behavior to
  `lib_flow_engine` when it is not MCP-specific.
- Keep high-level JSON-RPC routing visible in the public `McpServer` Flow and
  promote reusable branches to composite graph blocks in
  `libs/flow/blocks/*.block.yaml`. Keep shared JavaScript helpers in
  `libs/flow/lib/mcp.js` only for low-level local details that are not useful as
  Flow blocks, and declare those helpers with `uses` on each block that calls
  `ctx.lib(...)`.
- Keep the single-request router in `mcp.handle.block.yaml` so batch and
  request routing both expose their Flow implementation in the catalog tree.
- Keep `tools/call` routing visible too: `mcp.tools.call.block.yaml` should
  group tools by intent before delegating to small private blocks.
- For tools that only prepare MCP arguments, call one Flow capability and wrap
  the response, prefer a composite block using `mcp.tool.run` instead of a
  custom JavaScript wrapper.
- Use `/convertigo/api/flow-mcp` as the HTTP entry point. Do not use
  `/convertigo/api/mcp`, which belongs to the legacy Convertigo MCP project.
- Keep generated or one-off helper blocks private when they are not intended for
  projects referencing this library.
- Use `input.*` for executable/block inputs and `local.*` for scratch state in
  all new Flow YAML. `flow.*` and `props.*` are not expression scopes; JS
  hooks/raw implementations can inspect the raw node with `ctx.props(node)`.

Authoring loop for a blank agent context:

```text
resources/list
resources/read flow://guide/start
tools/list
flow-search to find flows, nodes, catalog entries and schemas; multi-word queries match unordered tokens
flow-tree / flow-get only for the narrow target
flow-context when choosing paths or expressions
flow-output-schema before wiring downstream nodes
flow-schema-reset before rerunning an HTTP learn scenario when the output changed
flow-get.definition -> edit object -> flow-set.definition for broad model edits
flow-node-add / flow-node-edit / flow-node-move / flow-node-delete / flow-node-duplicate
flow-apply / flow-edit for lower-level mutations
flow-test
flow-catalog only when search/examples are insufficient; it is summary by default
flow-block-get / flow-type-get only for source-level authoring
flow-block-create / flow-block-duplicate / flow-block-edit / flow-type-create only when the catalog is insufficient
flow-resource-search / flow-resource-get / flow-resource-patch for project JS/YAML/HTML/CSS/library maintenance patches
```

Prefer editing Flow sidecars over adding custom blocks. Prefer project-local
custom blocks over changing the shared core library. A Rhino block must be a
small primitive, not a hidden backend feature. Use FlowScript and standard
blocks for HTTP, requestables, list/JSON transforms and response mapping.
Core and shared blocks are read-only through MCP: use `flow-block-duplicate`
to create a project-local variant, then `flow-block-edit` to replace its
source.

When maintaining an existing custom block/composite block/fragment/type/editor/library,
prefer a code-like cycle: `flow-resource-search`, `flow-resource-get`, then
`flow-resource-patch` with the returned `baseHash`. The patch tool accepts
unified diff hunks and validates block/library JavaScript plus Flow block/type
descriptors and fragment YAML by default. Hunk line numbers may be approximate when the
context is unique.

Custom blocks use a `*.block.yaml` descriptor. Prefer `implementation.runtime:
flow` when the behavior is naturally expressed as a graph, and `rhino` with a
peer `*.js` file only for JVM/Java integration or low-level algorithmic code.
Rhino code may use Java classes through `Packages`, but not Node.js APIs such as
`require`, npm modules or browser globals.

Most tools accept `project` or `projectDir`. Use `project` for real Convertigo
workspaces and reserve `projectDir` for standalone tests. Never assume the MCP
host project is the project being edited.

Prefer targeted mutations over rewriting a whole Flow source. Use:

- `flow-search` to get `flowQName`, `nodeId` and a compact context;
- `flow-get.definition` then `flow-set.definition` when the edit is naturally
  a broad model rewrite;
- when writing a real project with `flow-set` or `flow-edit`, keep the default
  DBO registration/save/Studio refresh unless explicitly testing sidecars only;
- `flow-node-add/edit/move/delete/duplicate` for common node operations;
- always provide a stable `id` on added nodes and `newId` on duplicated nodes;
- semantic mutations by `nodeId`, for example
  `{op:"replace", nodeId:"setMessage", property:"value", value:"Done"}`;
- `afterNodeId`, `beforeNodeId`, or `parentNodeId + slot` for inserts;
- JSON Pointer paths such as `/nodes` or `/nodes/2/nodes` only for low-level
  edits;
- `flow-apply` to preview source changes;
- `flow-edit` to write a named sidecar once the mutation is correct.

Use `flow-type-create` only for real project vocabulary. Do not create custom
types when a core type such as `text`, `path`, `value`, `template`,
`expression`, `literal` or `requestable` already fits.

Prefer `flow-search` before broad reads. Multi-word queries match unordered
tokens, so a query like `GetFeed requestable call` should find a node whose
requestable is `AAAProject.GetFeed` and whose block is `requestable.call`. It returns compact matches with
`flowQName`, `nodeId`, canonical JSON Pointer `path`, `summary`, `snippet`, and
optional `context`. Start with `doc:true,hints:true`, then pass
`doc:false,hints:false` for repeated calls.

MCP resources mirror this guide for clients that do not read repo files:
`flow://guide/start`, `flow://guide/authoring`,
`flow://guide/search-and-edit`, and `flow://guide/custom-blocks`.
