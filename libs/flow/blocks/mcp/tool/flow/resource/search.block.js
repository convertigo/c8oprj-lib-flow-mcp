const _meta = {
  "version": 1,
  "description": "Runs the flow-resource-search MCP tool.",
  "icon": "mdi:file-search-outline",
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
  "display": "tool flow-resource-search -> {{ input.out }}"
}

function mcp_tool_flow_resource_search({ input, config, result }) {
  mcp.tool.run({ id: "runResourceSearch", request: input.request, target: "resource.search" })
}
