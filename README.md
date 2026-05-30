# lib_flow_mcp

Flow-native MCP server for Convertigo Flow authoring.

This project intentionally keeps MCP tooling outside `lib_flow_engine`.
`lib_flow_engine` remains the standard runtime vocabulary; this library owns the
MCP surface and any blocks specific to Flow authoring automation.

HTTP entry point:

```text
http://localhost:18080/convertigo/api/flow-mcp
```

The UrlMapper path is `/flow-mcp`; the trailing-slash variant `/flow-mcp/` is
also mapped to the same requestable. The legacy Convertigo MCP project keeps
`/mcp`.

Runtime shape:

```text
lib_flow_mcp.McpServer
  -> libs/flows/McpServer.flow.yaml
  -> libs/flow/blocks/mcp.flow.js
  -> lib_flow_engine.Engine
```

Use `mcp.flow` for MCP protocol plumbing only. When adding a new operation, ask
whether the underlying behavior is:

- general Flow runtime behavior: add it to `lib_flow_engine`;
- MCP authoring behavior: keep it here;
- project-specific glue: keep it in the target project, preferably private.

Default authoring cycle for a blank agent context:

```text
resources/list
resources/read flow://guide/start
tools/list
flow-search to find flows, nodes, catalog entries and schemas
flow-tree / flow-get only for the narrow target
flow-context when choosing paths or expressions
flow-output-schema when downstream nodes need the result shape
flow-schema-reset before rerunning an HTTP learn scenario when the output changed
flow-node-add / flow-node-edit / flow-node-move / flow-node-delete / flow-node-duplicate
flow-apply / flow-edit for lower-level mutations
flow-test
flow-catalog / flow-block-get / flow-type-get only when the contract is needed
flow-block-create / flow-block-duplicate / flow-block-edit / flow-type-create only when the catalog is insufficient
```

The default path remains catalog-first and sidecar-first. Custom blocks are
project vocabulary, not automatic core changes.

Most tools accept either:

- `project`: Convertigo project name, resolved by the live engine;
- `projectDir`: direct filesystem path, mainly for standalone tests.

When omitted, tools operate on `lib_flow_mcp` itself. Agents should pass
`project` for application work, for example `AAAProject`.

Mutation tools accept semantic node targets first. Prefer this shape after
`flow-search` returns a `nodeId`:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "replace",
    "nodeId": "setMessage",
    "property": "value",
    "value": "Done"
  }
}
```

Use `afterNodeId`, `beforeNodeId` or `parentNodeId + slot` to insert nodes
without hard-coding array indexes:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "insert",
    "afterNodeId": "setMessage",
    "value": {
      "id": "logDone",
      "block": "log",
      "message": "Done"
    }
  }
}
```

Low-level mutations can still use the same JSON Pointer syntax as the Flow
virtual tree:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "insert",
    "path": "/nodes",
    "index": "end",
    "value": {
      "id": "setMessage",
      "block": "set",
      "path": "result.message",
      "value": "Done"
    }
  }
}
```

Use `flow-apply` to preview the updated YAML source. Use `flow-edit` to apply
the same mutation to a named project Flow sidecar.

The common node wrappers are preferred when they fit:

- `flow-node-add`: add a node near another node or inside a parent slot.
- `flow-node-edit`: replace one property or merge several properties.
- `flow-node-move`: move a node by `nodeId`.
- `flow-node-delete`: delete a node by `nodeId`.
- `flow-node-duplicate`: duplicate a node and optionally patch the new copy.

`flow-node-add` requires a stable `id`. `flow-node-duplicate` requires `newId`
or `properties.id` to avoid creating duplicate ids.

Block authoring is intentionally explicit:

- `flow-block-get` reads any visible block source.
- `flow-block-create` writes a new project-local block.
- `flow-block-duplicate` copies a core/shared/project block to a new
  project-local name.
- `flow-block-edit` replaces the source of an existing project-local block.

Core and shared blocks are read-only through this MCP surface. Duplicate them
first when an agent needs a custom variant.

Search is the MCP equivalent of `rg` for Flow authoring:

```json
{
  "project": "AAAProject",
  "query": "temperature",
  "kinds": ["node"],
  "context": 1,
  "limit": 20
}
```

Each node match returns `flowQName`, `nodeId` and a canonical JSON Pointer
`path`. Use `nodeId` for semantic edits and `path` for low-level mutations.
Pass `doc:false,hints:false` once the agent has learned the tool contract.

MCP resources provide the same guidance to agents that cannot read this repo:

- `flow://guide/start`
- `flow://guide/authoring`
- `flow://guide/search-and-edit`
- `flow://guide/custom-blocks`
