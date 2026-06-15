const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-search-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
    "search"
  ],
  "description": "Searches FlowScript source and returns small matching extracts.",
  "display": "tool code-rg -> {{ input.out }}",
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

function mcp_tool_code_rg({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodeRg", request: input.request, operation: "rg" })
}
