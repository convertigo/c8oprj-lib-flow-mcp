const _meta = {
  "version": 1,
  "description": "Builds a JSON-RPC method-not-found error.",
  "icon": "mdi:alert-circle-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC request object."
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
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "method.notFound"
}

function mcp_method_notFound({ input, config, result }) {
  const response = mcp.response.error({ id: "error", request: input.request, code: -32601, message: "Method not found: " + (input.request.method || "") })
  return response
}
