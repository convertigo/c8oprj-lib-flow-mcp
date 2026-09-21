const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Creates or updates FullSync connector, design documents and standard CouchDB transactions through DBO APIs.",
  "icon": "mdi:database-sync-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response.",
    },
  },
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "private": true,
  "tags": [
    "mcp",
  ],
  "display": "tool flow-fullsync-scaffold -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_fullsync_scaffold({ input, config, result }) {
  mcp.tool.run({
    $$id: "runFlowFullSyncScaffold",
    request: input.request,
    target: "project.fullsync.scaffold",
    resolveProject: false,
  })
  return result
}
