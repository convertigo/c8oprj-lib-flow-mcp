const _meta = {
  "sourceVersion": 3,
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
  "display": "tool flow-requestable-list -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_requestable_list({ input, config, result }) {
  listRequestables: mcp.tool.run({ request: input.request, target: "requestable.list" })
}
