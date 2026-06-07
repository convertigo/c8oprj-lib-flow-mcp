const _meta = {
  "version": 1,
  "description": "Returns compact FlowScript code plus revision for one Flow.",
  "icon": "mdi:file-code-outline",
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
  "display": "tool flow-code-get -> {{ input.out }}"
}

function mcp_tool_flow_code_get({ input, config, result }) {
  mcp.tool.run({ id: "runCodeGet", request: input.request, target: "flow.code.get" })
}
