const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "icon": "mdi:file-remove-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
  ],
  "description": "Discards the executable FlowScript working copy.",
  "display": "tool code-discard -> {{ input.out }}",
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
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_code_discard({ input, config, result }) {
  mcp.tool.code.dispatch({
    $$id: "dispatchCodeDiscard",
    request: input.request,
    operation: "discard",
  })
}
