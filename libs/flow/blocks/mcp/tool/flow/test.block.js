const _meta = {
  "version": 1,
  "description": "Runs the flow-test MCP tool.",
  "icon": "mdi:test-tube",
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
  "display": "tool flow-test -> {{ input.out }}"
}

function mcp_tool_flow_test({ input, config, result }) {
  mcp.tool.run({ id: "testFlow", request: input.request, target: "flow.test" })
}
