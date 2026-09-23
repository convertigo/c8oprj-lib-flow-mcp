const _meta = {
  "sourceVersion": 2,
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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_cache_info({ input, config, result }) {
  mcp.tool.run({
    $$id: "runCacheInfo",
    request: input.request,
    target: "cache.info",
  })
}
