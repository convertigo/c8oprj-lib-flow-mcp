const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Builds a JSON-RPC method-not-found error.",
  "summary": [
    "method not found -> {{out}}",
    "method not found",
  ],
  "icon": "mdi:alert-circle-outline",
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
  "display": "method.notFound",
}

const _flow = { sourceVersion: 3 }

function mcp_method_notFound({ input, config, result }) {
  error: local.response = mcp.response.error({
    request: input.request,
    code: -32601,
    message: "Method not found: " + (input.request.method || ""),
    out: "local.response",
  })
  returnValue: return local.response
}
