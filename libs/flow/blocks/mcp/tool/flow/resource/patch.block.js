const _meta = {
  "version": 1,
  "description": "Runs the flow-resource-patch MCP tool.",
  "icon": "mdi:file-edit-outline",
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
  "display": "tool flow-resource-patch -> {{ input.out }}"
}

function mcp_tool_flow_resource_patch({ input, config, result }) {
  mcp.tool.run({ id: "runResourcePatch", request: input.request, target: "resource.patch" })
}
