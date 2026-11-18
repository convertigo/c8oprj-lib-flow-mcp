const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the flow-project-reference MCP tool.",
  "icon": "mdi:source-branch",
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
  "display": "tool flow-project-reference -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_project_reference({ input, config, result }) {
  runFlowProjectReference: mcp.tool.run({ request: input.request, target: "project.reference", resolveProject: false })
}
