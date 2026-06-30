const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:cached-off",
  "tags": [
    "mcp",
    "cache",
    "diagnostic"
  ],
  "description": "Debug only: clears Flow Engine runtime descriptor caches when automatic invalidation is suspected stale.",
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
  }
}

function mcp_tool_flow_cache_clear({ input, config, result }) {
  mcp.tool.run({ id: "runCacheClear", request: input.request, target: "cache.clear" })
}
