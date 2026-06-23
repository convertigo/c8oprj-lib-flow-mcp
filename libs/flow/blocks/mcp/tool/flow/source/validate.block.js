const _meta = {
  "version": 1,
  "description": "Validates FlowScript and returns Flow YAML plus diagnostics without writing.",
  "icon": "mdi:file-check-outline",
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
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp",
    "flowscript"
  ],
  "display": "tool flow-source-validate -> {{ input.out }}"
}

function mcp_tool_flow_source_validate({ input, config, result }) {
  mcp.tool.run({ id: "runSourceValidate", request: input.request, target: "flow.source.validate" })
}
