const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "private": true,
  "icon": "mdi:file-remove-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
  ],
  "description": "Discards the executable FlowScript working copy.",
  "display": "tool code-discard -> ${input.out}",
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

function mcp_tool_code_discard({ input, config, result }) {
  dispatchCodeDiscard: mcp.tool.code.dispatch({ request: input.request, operation: "discard" })
}
