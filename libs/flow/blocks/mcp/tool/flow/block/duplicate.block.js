const _meta = {
  "version": 1,
  "description": "Runs the flow-block-duplicate MCP tool.",
  "icon": "mdi:content-duplicate",
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
  "display": "tool flow-block-duplicate -> {{ input.out }}"
}

function mcp_tool_flow_block_duplicate({ input, config, result }) {
  mcp.tool.run({ id: "runBlockDuplicate", request: input.request, target: "block.duplicate" })
}
