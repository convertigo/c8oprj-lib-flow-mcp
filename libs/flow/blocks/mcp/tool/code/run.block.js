const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:play-box-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
    "runtime"
  ],
  "description": "Runs or tests the executable FlowScript working copy without resending code.",
  "display": "tool code-run -> {{ input.out }}",
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

function mcp_tool_code_run({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodeRun", request: input.request, operation: "run" })
}
