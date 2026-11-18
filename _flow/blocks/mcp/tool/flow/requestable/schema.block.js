const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Returns the known output schema and paths for a requestable.",
  "icon": "mdi:database-search-outline",
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
    "schema",
  ],
  "display": "tool flow-requestable-schema -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_requestable_schema({ input, config, result }) {
  requestableSchema: mcp.tool.run({ request: input.request, target: "requestable.schema" })
}
