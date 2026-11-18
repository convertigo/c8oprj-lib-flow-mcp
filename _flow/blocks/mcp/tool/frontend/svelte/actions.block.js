const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the frontend-svelte-actions MCP tool.",
  "icon": "mdi:dots-vertical-circle-outline",
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
  ],
  "display": "tool frontend-svelte-actions -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_frontend_svelte_actions({ input, config, result }) {
  frontendSvelteActions: mcp.tool.run({ request: input.request, target: "authoring.menu" })
}
