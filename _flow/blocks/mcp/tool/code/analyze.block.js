const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "private": true,
  "icon": "mdi:file-chart-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
  ],
  "description": "Analyzes the executable FlowScript working copy and returns scopes/diagnostics.",
  "display": "tool code-analyze -> ${input.out}",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response.",
    },
  },
}

const _flow = { sourceVersion: 3 }

function mcp_tool_code_analyze({ input, config, result }) {
  dispatchCodeAnalyze: mcp.tool.code.dispatch({ request: input.request, operation: "analyze" })
}
