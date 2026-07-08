const _meta = {
  "version": 1,
  "description": "Runs the authoring-palette MCP tool.",
  "icon": "mdi:palette-outline",
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
  "display": "tool authoring-palette -> {{ input.out }}"
}

function mcp_tool_authoring_palette({ input, config, result }) {
  mcp.tool.run({ id: "authoringPalette", request: input.request, target: "authoring.palette" })
}
