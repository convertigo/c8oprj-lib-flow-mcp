const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-clock-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Returns dirty/revision state for one executable FlowScript working copy.",
  "display": "tool code-status -> {{ input.out }}",
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

function mcp_tool_code_status({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodeStatus", request: input.request, operation: "status" })
}
