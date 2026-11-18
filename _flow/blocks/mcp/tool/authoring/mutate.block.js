const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the authoring-mutate MCP tool.",
  "icon": "mdi:source-branch-sync",
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
  "display": "tool authoring-mutate -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_authoring_mutate({ input, config, result }) {
  authoringMutate: mcp.tool.run({ request: input.request, target: "authoring.mutate" })
}
