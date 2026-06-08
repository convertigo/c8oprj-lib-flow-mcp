const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:cached",
  "tags": [
    "mcp",
    "cache",
    "diagnostic"
  ],
  "description": "Returns Flow Engine runtime cache diagnostics.",
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

function mcp_tool_flow_cache_info({ input, config, result }) {
  mcp.tool.run({ id: "runCacheInfo", request: input.request, target: "cache.info" })
}
