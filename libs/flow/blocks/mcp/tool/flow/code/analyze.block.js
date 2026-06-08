const _meta = {
  "version": 1,
  "description": "Analyzes the current FlowScript working copy or official Flow.",
  "icon": "mdi:file-search-outline",
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
    "mcp",
    "flowscript",
    "code"
  ],
  "display": "tool flow-code-analyze -> {{ input.out }}"
}

function mcp_tool_flow_code_analyze({ input, config, result }) {
  mcp.tool.run({ id: "analyzeCode", request: input.request, target: "flow.code.analyze" })
}
