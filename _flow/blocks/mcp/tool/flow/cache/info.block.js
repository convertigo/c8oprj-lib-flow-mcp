const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "private": true,
  "icon": "mdi:cached",
  "tags": [
    "mcp",
    "cache",
    "diagnostic",
  ],
  "description": "Returns Flow Engine runtime cache diagnostics.",
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

function mcp_tool_flow_cache_info({ input, config, result }) {
  runCacheInfo: mcp.tool.run({ request: input.request, target: "cache.info" })
}
