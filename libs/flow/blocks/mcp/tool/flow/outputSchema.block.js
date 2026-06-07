const _meta = {
  "version": 1,
  "description": "Runs the flow-output-schema MCP tool.",
  "icon": "mdi:code-json",
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
  "display": "tool flow-output-schema -> {{ input.out }}"
}

function mcp_tool_flow_outputSchema({ input, config, result }) {
  mcp.tool.run({ id: "readFlowOutputSchema", request: input.request, target: "flow.outputSchema" })
}
