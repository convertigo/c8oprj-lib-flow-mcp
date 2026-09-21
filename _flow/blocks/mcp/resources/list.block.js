const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds the MCP resources/list response.",
  "icon": "mdi:book-open-page-variant-outline",
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
  "display": "resources.list",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_resources_list({ input, config, result }) {
  resource.list({
    $$id: "listResourceFiles",
    $$out: "local.resourceList",
    rootDir: "libs/flow/resources",
    pattern: "**/*.md",
    out: "local.resourceList",
  })
  set({
    $$id: "resources",
    path: "local.resources",
    value: [],
  })
  forEach({
    $$id: "eachResource",
    items: local.resourceList.resources,
    $$nodes: function () {
      if({
        $$id: "if5",
        condition: !current.uri.startsWith("flow://skills/"),
        $$then: function () {
          json.push({
            $$id: "pushResource",
            path: "local.resources",
            $$nodes: function () {
              json.object({
                $$id: "resourceObject",
                $$fields: function () {
                  json.field({
                    $$id: "uri",
                    key: "uri",
                    value: current.uri,
                  })
                  json.field({
                    $$id: "name",
                    key: "name",
                    value: current.name,
                  })
                  json.field({
                    $$id: "description",
                    key: "description",
                    value: current.description,
                  })
                  json.field({
                    $$id: "mimeType",
                    key: "mimeType",
                    value: current.mimeType,
                  })
                },
              })
            },
          })
        },
      })
    },
  })
  json.object({
    $$id: "payload",
    $$out: "local.payload",
    out: "local.payload",
    $$fields: function () {
      json.field({
        $$id: "resources",
        key: "resources",
        value: local.resources,
      })
    },
  })
  mcp.response.result({
    $$id: "wrapResult",
    request: input.request,
    result: local.payload,
  })
  return result
}
