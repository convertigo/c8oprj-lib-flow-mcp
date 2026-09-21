const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Lists project requestables: sequences, Flows and connector transactions.",
  "icon": "mdi:format-list-bulleted-type",
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
    "requestable",
  ],
  "display": "tool flow-requestable-list -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_requestable_list({ input, config, result }) {
  mcp.tool.run({
    $$id: "listRequestables",
    request: input.request,
    target: "requestable.list",
  })
  return result
}
