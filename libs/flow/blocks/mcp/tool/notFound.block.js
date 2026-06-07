const _meta = {
  "version": 1,
  "description": "Builds an MCP unknown-tool error response.",
  "icon": "mdi:alert-circle-outline",
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
  "outputs": {
    "out": {
      "type": "unknown"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool not found"
}

function mcp_tool_notFound({ input, config, result }) {
  const response = mcp.response.error({ id: "error", request: input.request, code: -32000, message: "Unknown Flow MCP tool: " + ((input.request.params && input.request.params.name) || ""), data: {
    code: "FLOW_MCP_TOOL_ERROR"
  } })
  return response
}
