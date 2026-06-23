const _meta = {
  "version": 1,
  "description": "Returns FlowScript code for a Flow with a revision for patching.",
  "icon": "mdi:file-code-outline",
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
  "display": "tool flow-source-get -> {{ input.out }}"
}

function mcp_tool_flow_source_get({ input, config, result }) {
  mcp.tool.run({ id: "runSourceGet", request: input.request, target: "flow.source.get" })
}
