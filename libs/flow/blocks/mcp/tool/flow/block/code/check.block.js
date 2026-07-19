const _meta = {
  "version": 1,
  "description": "Validates one project-local target implementation without writing it.",
  "icon": "mdi:check-decagram-outline",
  "properties": {
    "request": { "kind": "expression", "type": "object", "default": "input.request", "description": "MCP JSON-RPC tools/call request object." },
    "out": { "kind": "path", "mode": "write", "default": "local.response", "description": "Scope path receiving the MCP response." }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "tags": ["mcp", "block", "code", "frontend", "check"],
  "display": "tool flow-block-code-check -> {{ input.out }}"
}

function mcp_tool_flow_block_code_check({ input, config, result }) {
  mcp.tool.run({ id: "runBlockCodeCheck", request: input.request, target: "block.code.check" })
}
