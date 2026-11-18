const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Returns compact FlowScript code plus revision for one Flow.",
  "icon": "mdi:file-code-outline",
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
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "private": true,
  "tags": [
    "mcp",
    "flowscript",
    "code",
  ],
  "display": "tool flow-code-get -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_code_get({ input, config, result }) {
  runCodeGet: mcp.tool.run({ request: input.request, target: "flow.code.get" })
}
