const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Runs the current FlowScript working copy or official Flow.",
  "icon": "mdi:play-box-outline",
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
    "flowscript",
    "code",
  ],
  "display": "tool flow-code-run -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_code_run({ input, config, result }) {
  runCode: mcp.tool.run({ request: input.request, target: "flow.code.run" })
}
