const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-check-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Writes and checks FlowScript for one executable Flow or project-local block.",
  "display": "tool code-set -> {{ input.out }}",
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

function mcp_tool_code_set({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodeSet", request: input.request, operation: "set" })
}
