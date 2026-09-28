const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Runs the flow-resource-delete MCP tool.",
  "icon": "mdi:file-remove-outline",
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
  "display": "tool flow-resource-delete -> {{ input.out }}",
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_resource_delete({ input, config, result }) {
  mcp.tool.run({
    $$id: "runResourceDelete",
    request: input.request,
    target: "resource.delete",
  })
}
