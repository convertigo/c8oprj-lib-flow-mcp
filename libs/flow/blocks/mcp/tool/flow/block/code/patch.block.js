const _meta = {
  "version": 1,
  "description": "Applies a revision-checked FlowScript block patch or replacement.",
  "icon": "mdi:puzzle-edit-outline",
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
    "flowscript",
    "block",
    "patch"
  ],
  "display": "tool flow-block-code-patch -> {{ input.out }}"
}

function mcp_tool_flow_block_code_patch({ input, config, result }) {
  mcp.tool.run({ id: "runBlockCodePatch", request: input.request, target: "block.code.patch" })
}
