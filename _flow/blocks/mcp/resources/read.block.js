const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds the MCP resources/read response.",
  "icon": "mdi:book-open-variant",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the MCP response.",
    },
  },
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "private": true,
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_resources_read({ input, config, result }) {
  resource.list({
    $$id: "listResourceFiles",
    $$out: "local.resourceList",
    rootDir: "libs/flow/resources",
    pattern: "**/*.md",
    out: "local.resourceList",
  })
  list.filter({
    $$id: "filterUri",
    $$out: "local.matches",
    items: local.resourceList.resources,
    where: current.uri == input.request.params.uri,
    out: "local.matches",
  })
  if({
    $$id: "if4",
    condition: length(local.matches) == 0,
    $$then: function () {
      mcp.response.error({
        $$id: "error",
        $$out: "local.response",
        request: input.request,
        code: -32000,
        message: "Unknown Flow MCP resource: " + (input.request.params.uri || ""),
        data: {
          "code": "FLOW_MCP_RESOURCE_ERROR",
        },
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  resource.get({
    $$id: "readResource",
    $$out: "local.resource",
    path: "{{ local.matches.0.path }}",
    out: "local.resource",
  })
  json.object({
    $$id: "content",
    $$out: "local.content",
    out: "local.content",
    $$fields: function () {
      json.field({
        $$id: "uri",
        key: "uri",
        value: local.resource.uri,
      })
      json.field({
        $$id: "mimeType",
        key: "mimeType",
        value: local.resource.mimeType,
      })
      json.field({
        $$id: "text",
        key: "text",
        value: local.resource.content,
      })
    },
  })
  json.object({
    $$id: "payload",
    $$out: "local.payload",
    out: "local.payload",
    $$fields: function () {
      json.field({
        $$id: "contents",
        key: "contents",
        value: [
          local.content,
        ],
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
