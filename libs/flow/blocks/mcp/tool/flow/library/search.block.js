const _meta = {
  "version": 1,
  "description": "Runs the flow-library-search MCP tool.",
  "icon": "mdi:bookshelf",
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
    "out": { "type": "object" }
  },
  "private": true,
  "tags": ["mcp"],
  "display": "tool flow-library-search -> {{ input.out }}"
}

function mcp_tool_flow_library_search({ input, config, result }) {
  mcp.tool.run({
    id: "runFlowLibrarySearch",
    request: input.request,
    target: "project.library.search"
  })
}
