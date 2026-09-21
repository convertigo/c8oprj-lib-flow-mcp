const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds a JSON-RPC method-not-found error.",
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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_method_notFound({ input, config, result }) {
  mcp.response.error({
    $$id: "error",
    $$out: "local.response",
    request: input.request,
    code: -32601,
    message: "Method not found: " + (input.request.method || ""),
    out: "local.response",
  })
  return({
    $$id: "returnValue",
    value: local.response,
  })
}
