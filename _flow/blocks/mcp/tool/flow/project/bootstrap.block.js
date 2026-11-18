const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the flow-project-bootstrap MCP tool.",
  "icon": "mdi:application-import",
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
  "display": "tool flow-project-bootstrap -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_project_bootstrap({ input, config, result }) {
  runFlowProjectBootstrap: mcp.tool.run({ request: input.request, target: "project.bootstrap", resolveProject: false })
}
