const _meta = {
  "version": 1,
  "description": "Builds the MCP tools/list response.",
  "icon": "mdi:format-list-bulleted-square",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC request object."
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
    "mcp"
  ],
  "display": "tools.list -> {{ input.out }}"
}

function mcp_tools_list({ input, config, result }) {
  const tools = mcp.tools.available({ id: "availableTools" })
  const payload = json.object({ id: "payload" }) {
    json.field({ id: "tools", key: "tools", value: tools })
  }
  mcp.response.result({ id: "response", request: input.request, result: payload })
}
