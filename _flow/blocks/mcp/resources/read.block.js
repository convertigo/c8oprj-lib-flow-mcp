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
  local.resourceList = resource.list({
    $$id: "listResourceFiles",
    rootDir: "_flow/resources",
    pattern: "**/*.md",
  })
  local.matches = list.filter({
    $$id: "filterUri",
    items: local.resourceList.resources,
    where: current.uri == input.request.params.uri,
  })
  if({
    $$id: "if4",
    condition: length(local.matches) == 0,
    $$then: function () {
      local.response = mcp.response.error({
        $$id: "error",
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
  local.resource = resource.get({
    $$id: "readResource",
    path: "{{ local.matches.0.path }}",
  })
  local.content = json.object({
    $$id: "content",
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
  local.payload = json.object({
    $$id: "payload",
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
}
