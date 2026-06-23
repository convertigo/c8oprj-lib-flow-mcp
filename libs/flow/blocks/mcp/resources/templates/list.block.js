const _meta = {
  "version": 1,
  "description": "Builds the MCP resources/templates/list response.",
  "icon": "mdi:file-tree-outline",
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
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "resources.templates.list"
}

function mcp_resources_templates_list({ input, config, result }) {
  const payload = json.object({ id: "payload" }) {
    json.field({ id: "resourceTemplates", key: "resourceTemplates", value: [] })
  }
  const response = mcp.response.result({ id: "wrapResult", request: input.request, result: payload })
}
