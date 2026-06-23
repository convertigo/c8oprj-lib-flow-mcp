const _meta = {
  "version": 1,
  "description": "Runs the flow-analyze MCP tool. Use it like a static schema/data-flow manager before editing expressions.",
  "icon": "mdi:chart-timeline-variant",
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
  "display": "tool flow-analyze -> {{ input.out }}"
}

function mcp_tool_flow_analyze({ input, config, result }) {
  mcp.tool.run({ id: "runFlowAnalyze", request: input.request, target: "flow.analyze" })
}
