const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:source-commit",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Executable Flow only: promotes a checked FlowScript working copy. Project-local blocks are saved directly by code-set/code-patch.",
  "display": "tool code-promote -> {{ input.out }}",
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

function mcp_tool_code_promote({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodePromote", request: input.request, operation: "promote" })
}
