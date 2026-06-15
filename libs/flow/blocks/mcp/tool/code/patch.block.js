const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-edit-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code",
    "patch"
  ],
  "description": "Applies a revision-checked FlowScript patch to one executable Flow or project-local block.",
  "display": "tool code-patch -> {{ input.out }}",
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
  }
}

function mcp_tool_code_patch({ input, config, result }) {
  mcp.tool.code.dispatch({ id: "dispatchCodePatch", request: input.request, operation: "patch" })
}
