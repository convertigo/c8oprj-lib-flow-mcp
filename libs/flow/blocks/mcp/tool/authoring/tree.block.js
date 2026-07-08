const _meta = {
  "version": 1,
  "description": "Runs the authoring-tree MCP tool.",
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
  "display": "tool authoring-tree -> {{ input.out }}"
}

function mcp_tool_authoring_tree({ input, config, result }) {
  mcp.tool.run({ id: "authoringTree", request: input.request, target: "authoring.tree" })
}
