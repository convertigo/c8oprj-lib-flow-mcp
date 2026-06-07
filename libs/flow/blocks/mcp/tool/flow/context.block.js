const _meta = {
  "version": 1,
  "description": "Runs the flow-context MCP tool.",
  "icon": "mdi:graph-outline",
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
  "display": "tool flow-context -> {{ input.out }}"
}

function mcp_tool_flow_context({ input, config, result }) {
  mcp.tool.run({ id: "describeFlowContext", request: input.request, target: "flow.context" })
}
