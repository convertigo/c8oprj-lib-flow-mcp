const _meta = {
  "version": 1,
  "description": "Runs the flow-block-edit MCP tool.",
  "icon": "mdi:puzzle-edit-outline",
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
  "display": "tool flow-block-edit -> {{ input.out }}"
}

function mcp_tool_flow_block_edit({ input, config, result }) {
  mcp.tool.run({ id: "runBlockEdit", request: input.request, target: "block.edit" })
}
