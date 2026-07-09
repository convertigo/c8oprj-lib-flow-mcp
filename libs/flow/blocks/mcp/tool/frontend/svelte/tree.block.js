const _meta = {
  "version": 1,
  "description": "Runs the frontend-svelte-tree MCP tool.",
  "icon": "mdi:file-tree-outline",
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
  "display": "tool frontend-svelte-tree -> {{ input.out }}"
}

function mcp_tool_frontend_svelte_tree({ input, config, result }) {
  mcp.tool.run({ id: "frontendSvelteTree", request: input.request, target: "authoring.tree" })
}
