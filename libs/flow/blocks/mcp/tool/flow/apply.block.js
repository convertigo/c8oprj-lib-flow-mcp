const _meta = {
  "version": 1,
  "description": "Runs the flow-apply MCP tool.",
  "icon": "mdi:source-branch-sync",
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
  "display": "tool flow-apply -> {{ input.out }}"
}

function mcp_tool_flow_apply({ input, config, result }) {
  mcp.tool.run({ id: "applyFlowMutation", request: input.request, target: "flow.apply" })
}
