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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

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
