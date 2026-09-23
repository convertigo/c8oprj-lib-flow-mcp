const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds an MCP unknown-tool error response.",
  "icon": "mdi:alert-circle-outline",
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
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "private": true,
  "tags": [
    "mcp",
  ],
  "display": "tool not found",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_notFound({ input, config, result }) {
  local.response = mcp.response.error({
    $$id: "error",
    request: input.request,
    code: -32000,
    message: "Unknown Flow MCP tool: " + ((input.request.params && input.request.params.name) || ""),
    data: {
      "code": "FLOW_MCP_TOOL_ERROR",
    },
    out: "local.response",
  })
  return({
    $$id: "returnValue",
    value: local.response,
  })
}
