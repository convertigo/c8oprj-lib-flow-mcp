const _meta = {
  "version": 1,
  "description": "Runs the flow-resource-delete MCP tool.",
  "icon": "mdi:file-remove-outline",
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
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool flow-resource-delete -> {{ input.out }}"
}

function mcp_tool_flow_resource_delete({ input, config, result }) {
  mcp.tool.run({ id: "runResourceDelete", request: input.request, target: "resource.delete" })
}
