const _meta = {
  "version": 1,
  "description": "Searches FlowScript block code and returns small matching extracts.",
  "icon": "mdi:puzzle-search-outline",
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
    "mcp",
    "flowscript",
    "block",
    "search"
  ],
  "display": "tool flow-block-code-rg -> {{ input.out }}"
}

function mcp_tool_flow_block_code_rg({ input, config, result }) {
  mcp.tool.run({ id: "runBlockCodeRg", request: input.request, target: "block.code.rg" })
}
