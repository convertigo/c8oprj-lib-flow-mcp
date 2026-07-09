const _meta = {
  "version": 1,
  "description": "Runs the frontend-svelte-mutate MCP tool.",
  "icon": "mdi:source-branch-sync",
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
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool frontend-svelte-mutate -> {{ input.out }}"
}

function mcp_tool_frontend_svelte_mutate({ input, config, result }) {
  mcp.tool.run({ id: "frontendSvelteMutate", request: input.request, target: "authoring.mutate" })
}
