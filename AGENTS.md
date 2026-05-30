# Flow MCP Authoring Guide

This project is the Flow-native MCP server. Keep it separate from
`lib_flow_engine`.

Rules:

- Do not add general runtime blocks here; put them in `lib_flow_engine`.
- Put MCP protocol routing, Flow authoring tools and agent-only helpers here.
- Prefer a small MCP tool that calls core engine APIs over a large block that
  duplicates engine logic.
- Use `/convertigo/api/flow-mcp` as the HTTP entry point. Do not use
  `/convertigo/api/mcp`, which belongs to the legacy Convertigo MCP project.
- Keep generated or one-off helper blocks private when they are not intended for
  projects referencing this library.

Authoring loop for a blank agent context:

```text
resources/list
resources/read flow://guide/start
tools/list
flow-search to find flows, nodes, catalog entries and schemas
flow-tree / flow-get only for the narrow target
flow-context when choosing paths or expressions
flow-output-schema before wiring downstream nodes
flow-schema-reset before rerunning an HTTP learn scenario when the output changed
flow-node-add / flow-node-edit / flow-node-move / flow-node-delete / flow-node-duplicate
flow-apply / flow-edit for lower-level mutations
flow-test
flow-catalog / flow-block-get / flow-type-get only when the contract is needed
flow-block-create / flow-block-duplicate / flow-block-edit / flow-type-create only when the catalog is insufficient
```

Prefer editing Flow sidecars over adding custom blocks. Prefer project-local
custom blocks over changing the shared core library.
Core and shared blocks are read-only through MCP: use `flow-block-duplicate`
to create a project-local variant, then `flow-block-edit` to replace its
source.

Most tools accept `project` or `projectDir`. Use `project` for real Convertigo
workspaces and reserve `projectDir` for standalone tests. Never assume the MCP
host project is the project being edited.

Prefer targeted mutations over rewriting a whole Flow source. Use:

- `flow-search` to get `flowQName`, `nodeId` and a compact context;
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

Prefer `flow-search` before broad reads. It returns compact matches with
`flowQName`, `nodeId`, canonical JSON Pointer `path`, `summary`, `snippet`, and
optional `context`. Start with `doc:true,hints:true`, then pass
`doc:false,hints:false` for repeated calls.

MCP resources mirror this guide for clients that do not read repo files:
`flow://guide/start`, `flow://guide/authoring`,
`flow://guide/search-and-edit`, and `flow://guide/custom-blocks`.
