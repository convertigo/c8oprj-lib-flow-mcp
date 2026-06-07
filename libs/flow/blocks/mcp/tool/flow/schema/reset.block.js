const _meta = {
  "version": 1,
  "description": "Runs the flow-schema-reset MCP tool.",
  "icon": "mdi:database-refresh-outline",
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
      "type": "unknown"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool flow-schema-reset -> {{ input.out }}"
}

function mcp_tool_flow_schema_reset({ input, config, result }) {
  mcp.tool.run({ id: "resetFlowSchema", request: input.request, target: "flow.schema.reset" })
}
