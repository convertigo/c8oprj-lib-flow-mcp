const _meta = {
  "version": 1,
  "description": "Reads project-local custom block code only; do not use for standard http/list/json/requestable blocks.",
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
    "block"
  ],
  "display": "tool flow-block-code-get -> {{ input.out }}"
}

function mcp_tool_flow_block_code_get({ input, config, result }) {
  mcp.tool.run({ id: "runBlockCodeGet", request: input.request, target: "block.code.get" })
}
