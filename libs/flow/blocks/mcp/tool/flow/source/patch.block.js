const _meta = {
  "version": 1,
  "description": "Applies a revision-checked FlowScript patch and writes the Flow sidecar.",
  "icon": "mdi:file-edit-outline",
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
  "display": "tool flow-source-patch -> {{ input.out }}"
}

function mcp_tool_flow_source_patch({ input, config, result }) {
  mcp.tool.run({ id: "runSourcePatch", request: input.request, target: "flow.source.patch" })
}
