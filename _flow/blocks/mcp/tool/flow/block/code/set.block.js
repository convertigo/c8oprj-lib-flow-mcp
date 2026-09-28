const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Creates or updates one project-local FlowScript block. Prefer this for reusable composed behavior; keep the parent Flow algorithm visible.",
  "icon": "mdi:puzzle-edit-outline",
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
    "block",
  ],
  "display": "tool flow-block-code-set -> {{ input.out }}",
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_flow_block_code_set({ input, config, result }) {
  mcp.tool.run({
    $$id: "runBlockCodeSet",
    request: input.request,
    target: "block.code.set",
  })
}
