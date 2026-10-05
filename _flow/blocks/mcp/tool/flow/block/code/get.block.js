const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Reads project-local custom block code only; do not use for standard http/list/json/requestable blocks.",
  "icon": "mdi:puzzle-outline",
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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_block_code_get({ input, config, result }) {
  mcp.tool.run({
    $$id: "runBlockCodeGet",
    request: input.request,
    target: "block.code.get",
  })
}
