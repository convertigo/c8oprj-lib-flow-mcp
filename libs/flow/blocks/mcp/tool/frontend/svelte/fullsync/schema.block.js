const _meta = {
  "version": 1,
  "description": "Learns and attaches a schema to a Svelte FullSync action.",
  "icon": "mdi:database-import-outline",
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
      "default": "local.response"
    }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "tags": ["mcp"]
}

function mcp_tool_frontend_svelte_fullsync_schema({ input, config, result }) {
  mcp.tool.run({ id: "frontendSvelteFullSyncSchema", request: input.request, target: "frontend.fullsync.schema.attach" })
}

