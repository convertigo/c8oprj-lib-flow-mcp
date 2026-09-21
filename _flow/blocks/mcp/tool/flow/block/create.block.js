const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Raw project block creation. Rhino HTTP/requestable code is rejected; prefer flow-block-code-set and keep IO visible through FlowScript nodes.",
  "icon": "mdi:puzzle-plus-outline",
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
  "display": "tool flow-block-create -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_block_create({ input, config, result }) {
  mcp.tool.run({
    $$id: "runBlockCreate",
    request: input.request,
    target: "block.create",
  })
  return result
}
