const _meta = {
  "version": 1,
  "description": "Searches FlowScript code and returns small matching extracts.",
  "icon": "mdi:file-search-outline",
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
    "mcp",
    "flowscript",
    "code"
  ],
  "display": "tool flow-code-rg -> {{ input.out }}"
}

function mcp_tool_flow_code_rg({ input, config, result }) {
  mcp.tool.run({ id: "runCodeRg", request: input.request, target: "flow.code.rg" })
}
