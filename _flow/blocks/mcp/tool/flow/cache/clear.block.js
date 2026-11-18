const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "private": true,
  "icon": "mdi:delete-sweep-outline",
  "tags": [
    "mcp",
    "cache",
    "diagnostic",
  ],
  "description": "Debug only: clears Flow Engine runtime descriptor caches when automatic invalidation is suspected stale.",
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
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_cache_clear({ input, config, result }) {
  runCacheClear: mcp.tool.run({ request: input.request, target: "cache.clear" })
}
