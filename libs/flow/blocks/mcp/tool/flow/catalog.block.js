const _meta = {
  "version": 1,
  "description": "Lists palette only for unknown blocks; do not call for standard http/list/filter/sort/take/map FlowScript.",
  "icon": "mdi:puzzle-outline",
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
  "display": "tool flow-catalog -> {{ input.out }}"
}

function mcp_tool_flow_catalog({ input, config, result }) {
  mcp.tool.run({ id: "runCatalog", request: input.request, target: "block.list" })
}
