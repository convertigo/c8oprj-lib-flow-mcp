const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds the MCP resources/templates/list response.",
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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_resources_templates_list({ input, config, result }) {
  json.object({
    $$id: "payload",
    $$out: "local.payload",
    out: "local.payload",
    $$fields: function () {
      json.field({
        $$id: "resourceTemplates",
        key: "resourceTemplates",
        value: [],
      })
    },
  })
  mcp.response.result({
    $$id: "wrapResult",
    $$out: "local.response",
    request: input.request,
    result: local.payload,
    out: "local.response",
  })
  return result
}
