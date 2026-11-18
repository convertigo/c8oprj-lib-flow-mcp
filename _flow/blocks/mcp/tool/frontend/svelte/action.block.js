const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the frontend-svelte-action MCP tool.",
  "icon": "mdi:play-circle-outline",
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
  "display": "tool frontend-svelte-action -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_frontend_svelte_action({ input, config, result }) {
  frontendSvelteAction: mcp.tool.run({ request: input.request, target: "authoring.action" })
}
