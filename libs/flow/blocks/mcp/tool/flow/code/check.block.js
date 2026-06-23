const _meta = {
  "version": 1,
  "description": "Checks the current FlowScript working copy without running it.",
  "icon": "mdi:check-decagram-outline",
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
    "mcp",
    "flowscript",
    "code"
  ],
  "display": "tool flow-code-check -> {{ input.out }}"
}

function mcp_tool_flow_code_check({ input, config, result }) {
  mcp.tool.run({ id: "checkCode", request: input.request, target: "flow.code.check" })
}
