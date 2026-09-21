const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Reads project-local custom block code only; do not use for standard http/list/json/requestable blocks.",
  "icon": "mdi:puzzle-search-outline",
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
    "block",
  ],
  "display": "tool flow-block-code-get -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_block_code_get({ input, config, result }) {
  mcp.tool.run({
    $$id: "runBlockCodeGet",
    request: input.request,
    target: "block.code.get",
  })
  return result
}
