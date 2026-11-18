const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the flow-project-symbol-set MCP tool.",
  "icon": "mdi:tag-text-outline",
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
  ],
  "display": "tool flow-project-symbol-set -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_project_symbol_set({ input, config, result }) {
  runFlowProjectSymbolSet: mcp.tool.run({ request: input.request, target: "project.symbolSet" })
}
