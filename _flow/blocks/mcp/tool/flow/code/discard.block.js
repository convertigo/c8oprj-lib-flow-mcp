const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Discards a FlowScript working copy and falls back to the official Flow.",
  "icon": "mdi:file-undo-outline",
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
  "display": "tool flow-code-discard -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_code_discard({ input, config, result }) {
  discardCode: mcp.tool.run({ request: input.request, target: "flow.code.discard" })
}
