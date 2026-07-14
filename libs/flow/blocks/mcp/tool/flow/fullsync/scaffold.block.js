const _meta = {
  "version": 1,
  "description": "Creates or updates FullSync connector, design documents and standard CouchDB transactions through DBO APIs.",
  "icon": "mdi:database-sync-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "tags": ["mcp"],
  "display": "tool flow-fullsync-scaffold -> {{ input.out }}"
}

function mcp_tool_flow_fullsync_scaffold({ input, config, result }) {
  mcp.tool.run({
    id: "runFlowFullSyncScaffold",
    request: input.request,
    target: "project.fullsync.scaffold",
    resolveProject: false
  })
}
