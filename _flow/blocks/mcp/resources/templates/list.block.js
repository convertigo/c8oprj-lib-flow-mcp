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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_resources_templates_list({ input, config, result }) {
  local.payload = json.object({
    $$id: "payload",
    $$fields: function () {
      json.field({
        $$id: "resourceTemplates",
        key: "resourceTemplates",
        value: [],
      })
    },
  })
  local.response = mcp.response.result({
    $$id: "wrapResult",
    request: input.request,
    result: local.payload,
    out: "local.response",
  })
}
