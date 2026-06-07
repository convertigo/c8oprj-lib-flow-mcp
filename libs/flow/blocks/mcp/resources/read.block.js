const _meta = {
  "version": 1,
  "description": "Builds the MCP resources/read response.",
  "icon": "mdi:book-open-variant",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": {
    "out": {
      "type": "unknown"
    }
  },
  "private": true
}

function mcp_resources_read({ input, config, result }) {
  const resourceList = resource.list({ id: "listResourceFiles", rootDir: "libs/flow/resources", pattern: "**/*.md" })
  const matches = list.filter({ id: "filterUri", items: resourceList.resources, where: current.uri == input.request.params.uri })
  if (length(matches) == 0) {
    const response = mcp.response.error({ id: "error", request: input.request, code: -32000, message: "Unknown Flow MCP resource: " + (input.request.params.uri || ""), data: {
      code: "FLOW_MCP_RESOURCE_ERROR"
    } })
    return response
  }
  const resource = resource.get({ id: "readResource", path: "{{ local.matches.0.path }}" })
  const content = json.object({ id: "content" }) {
    json.field({ id: "uri", key: "uri", value: resource.uri })
    json.field({ id: "mimeType", key: "mimeType", value: resource.mimeType })
    json.field({ id: "text", key: "text", value: resource.content })
  }
  const payload = json.object({ id: "payload" }) {
    json.field({ id: "contents", key: "contents", value: ["{{ local.content }}"] })
  }
  mcp.response.result({ id: "wrapResult", request: input.request, result: payload })
}
