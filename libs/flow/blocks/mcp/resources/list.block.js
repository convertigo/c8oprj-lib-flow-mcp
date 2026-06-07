const _meta = {
  "version": 1,
  "description": "Builds the MCP resources/list response.",
  "icon": "mdi:book-open-page-variant-outline",
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
  "display": "resources.list"
}

function mcp_resources_list({ input, config, result }) {
  const resourceList = resource.list({ id: "listResourceFiles", rootDir: "libs/flow/resources", pattern: "**/*.md" })
  const resources = []
  forEach({ id: "eachResource", items: resourceList.resources }) {
    json.push({ id: "pushResource", path: "local.resources" }) {
      json.object({ id: "resourceObject" }) {
        json.field({ id: "uri", key: "uri", value: current.uri })
        json.field({ id: "name", key: "name", value: current.name })
        json.field({ id: "description", key: "description", value: current.description })
        json.field({ id: "mimeType", key: "mimeType", value: current.mimeType })
      }
    }
  }
  const payload = json.object({ id: "payload" }) {
    json.field({ id: "resources", key: "resources", value: resources })
  }
  mcp.response.result({ id: "wrapResult", request: input.request, result: payload })
}
