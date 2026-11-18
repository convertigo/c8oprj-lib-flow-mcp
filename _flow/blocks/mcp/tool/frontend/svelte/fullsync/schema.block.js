const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Learns and attaches a schema to a Svelte FullSync action.",
  "icon": "mdi:database-import-outline",
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
}

const _flow = { sourceVersion: 3 }

function mcp_tool_frontend_svelte_fullsync_schema({ input, config, result }) {
  frontendSvelteFullSyncSchema: mcp.tool.run({ request: input.request, target: "frontend.fullsync.schema.attach" })
}
