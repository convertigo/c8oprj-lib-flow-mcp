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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

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
    $$comment: "Guides and skills are served whole: never cut them at the default preview size.",
    path: "{{ local.matches.0.path }}",
    allowLarge: true,
  })
  if({
    $$id: "ifTruncated",
    condition: local.resource.truncated == true,
    $$then: function () {
      local.truncatedResponse = mcp.response.error({
        $$id: "truncatedError",
        request: input.request,
        code: -32000,
        message: "Flow MCP resource could not be read completely: " + input.request.params.uri,
        data: {
          "code": "FLOW_MCP_RESOURCE_TRUNCATED",
        },
        out: "local.truncatedResponse",
      })
      return({
        $$id: "returnTruncated",
        value: local.truncatedResponse,
      })
    },
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
