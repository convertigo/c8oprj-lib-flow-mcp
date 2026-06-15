const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:check-decagram-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Checks the executable FlowScript working copy without running it.",
  "display": "tool code-check -> {{ input.out }}",
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
  }
}

function mcp_tool_code_check({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodeCheck", request: input.request, operation: "check" })
}
