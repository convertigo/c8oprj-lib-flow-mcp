const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Builds the MCP resources/templates/list response.",
  "summary": [
    "resources/templates/list -> {{out}}",
    "resources/templates/list",
  ],
  "icon": "mdi:file-tree-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC request object.",
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
  "display": "resources.templates.list",
}

const _flow = { sourceVersion: 3 }

function mcp_resources_templates_list({ input, config, result }) {
  json.object({
    $$out: "local.payload",
    $$fields: function () {
      resourceTemplates: json.field({ key: "resourceTemplates", value: [] })
    },
  })
  wrapResult: local.response = mcp.response.result({
    request: input.request,
    result: local.payload,
    out: "local.response",
  })
}
