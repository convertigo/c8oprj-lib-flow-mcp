const _meta = {
  "version": 1,
  "description": "Runs the flow-run MCP tool.",
  "icon": "mdi:play-circle-outline",
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
  "display": "tool flow-run -> {{ input.out }}"
}

function mcp_tool_flow_run({ input, config, result }) {
  mcp.tool.run({ id: "runFlow", request: input.request, target: "flow.run" })
}
