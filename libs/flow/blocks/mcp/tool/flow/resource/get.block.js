const _meta = {
  "version": 1,
  "description": "Runs the flow-resource-get MCP tool.",
  "icon": "mdi:file-code-outline",
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
  "display": "tool flow-resource-get -> {{ input.out }}"
}

function mcp_tool_flow_resource_get({ input, config, result }) {
  mcp.tool.run({ id: "runResourceGet", request: input.request, target: "resource.get" })
}
