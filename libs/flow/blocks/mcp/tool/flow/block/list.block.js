const _meta = {
  "version": 1,
  "description": "Runs the flow-block-list MCP tool.",
  "icon": "mdi:puzzle-outline",
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
  "display": "tool flow-block-list -> {{ input.out }}"
}

function mcp_tool_flow_block_list({ input, config, result }) {
  mcp.tool.run({ id: "runBlockList", request: input.request, target: "block.list" })
}
