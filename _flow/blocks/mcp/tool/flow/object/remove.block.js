const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the flow-object-remove MCP tool.",
  "icon": "mdi:delete-outline",
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
  "display": "tool flow-object-remove -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_object_remove({ input, config, result }) {
  runFlowObjectRemove: mcp.tool.run({ request: input.request, target: "object.remove" })
}
