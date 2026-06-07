const _meta = {
  "version": 1,
  "description": "Previews an unsaved Flow definition before writing it with flow-set.",
  "icon": "mdi:puzzle-check-outline",
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
  "display": "preview Flow definition -> {{ input.out }}"
}

function mcp_tool_flow_block_test({ input, config, result }) {
  mcp.tool.run({ id: "testFlowBlock", request: input.request, target: "flow.run" })
}
