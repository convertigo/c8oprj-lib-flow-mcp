const _meta = {
  "version": 1,
  "description": "Runs the flow-type-create MCP tool.",
  "icon": "mdi:shape-plus-outline",
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
  "display": "tool flow-type-create -> {{ input.out }}"
}

function mcp_tool_flow_type_create({ input, config, result }) {
  mcp.tool.run({ id: "runTypeCreate", request: input.request, target: "type.create" })
}
