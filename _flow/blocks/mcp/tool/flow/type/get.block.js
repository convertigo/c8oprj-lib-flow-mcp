const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Runs the flow-type-get MCP tool.",
  "icon": "mdi:shape-outline",
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
  "display": "tool flow-type-get -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_type_get({ input, config, result }) {
  mcp.tool.run({
    $$id: "runTypeGet",
    request: input.request,
    target: "type.get",
  })
  return result
}
