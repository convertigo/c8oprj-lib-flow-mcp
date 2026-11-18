const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Builds the MCP initialize response.",
  "summary": [
    "initialize -> {{out}}",
    "initialize",
  ],
  "icon": "mdi:hand-wave-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC request object.",
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
  "display": "initialize",
}

const _flow = { sourceVersion: 3 }

function mcp_initialize({ input, config, result }) {
  local.serverInfo = mcp.server.info({})
  wrapResult: mcp.response.result({
    request: input.request,
    result: { protocolVersion: "2025-06-18", serverInfo: local.serverInfo, capabilities: { tools: {}, resources: {} } },
  })
}
