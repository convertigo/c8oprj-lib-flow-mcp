const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Builds the MCP resources/list response.",
  "summary": [
    "resources/list -> {{out}}",
    "resources/list",
  ],
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

const _flow = { sourceVersion: 3 }

function mcp_resources_list({ input, config, result }) {
  listResourceFiles: local.resourceList = resource.list({ rootDir: "_flow/resources", pattern: "**/*.md" })
  local.resources = []
  eachResource: flow.forEach({
    items: local.resourceList.resources,
    $$nodes: function () {
      if5: if (!current.uri.startsWith("flow://skills/") && !current.uri.startsWith("flow://ace/")) {
        pushResource: json.push({
          path: "local.resources",
          $$nodes: function () {
            resourceObject: json.object({
              $$fields: function () {
                uri: json.field({ key: "uri", value: current.uri })
                name: json.field({ key: "name", value: current.name })
                description: json.field({ key: "description", value: current.description })
                mimeType: json.field({ key: "mimeType", value: current.mimeType })
                size: json.field({ key: "size", value: current.size })
              },
            })
          },
        })
      }
    },
  })
  // Guides shipped by workspace libraries, read with resources/read like the Flow guides.
  local.libraryGuides = mcp.resources.library({ operation: "list", out: "local.libraryGuides" })
  eachLibraryGuide: flow.forEach({
    items: local.libraryGuides,
    $$nodes: function () {
      pushLibraryGuide: json.push({ path: "local.resources", value: current })
    },
  })
  local.experienceResources = mcp.experience({
    request: input.request,
    operation: "list",
    out: "local.experienceResources",
  })
  for (const item of local.experienceResources) {
    json.push({ path: "local.resources", value: item })
  }
  // Each guide description ends with its size in KB, computed from its bytes, so a reader can choose the shorter guide.
  guideSizes: local.resources = mcp.resources.library({
    operation: "sizes",
    items: local.resources,
    out: "local.resources",
  })
  local.entryGuides = [
    "flow://guide/start",
    "flow://guide/start-rules",
    "flow://guide/authoring",
    "flow://guide/samples",
    "flow://guide/frontend-svelte",
    "flow://guide/frontend-svelte-routing",
    "flow://guide/fullstack-paperboard",
    "flow://guide/portable-blocks",
  ]
  local.resources = list.sort({
    items: local.resources,
    by: (local.entryGuides.indexOf(current.uri) >= 0 ? "0" + local.entryGuides.indexOf(current.uri) :
      current.uri.startsWith("flow://guide/") ? current.uri.substring("flow://guide/".length).includes("/") ? "2" :
      "1" : "3") + current.uri,
    direction: "asc",
  })
  // MCP cursors are offsets into the stable, ordered resource list. A small
  // page leaves room for library metadata and the JSON-RPC envelope.
  local.cursor = Number(input.request.params && input.request.params.cursor || 0)
  if (!Number.isFinite(local.cursor) || local.cursor < 0 || Math.floor(local.cursor) !== local.cursor) {
    local.cursor = 0
  }
  local.nextCursor = local.cursor + 20 < local.resources.length ? String(local.cursor + 20) : null
  local.resources = local.resources.slice(local.cursor, local.cursor + 20)
  json.object({
    $$out: "local.payload",
    $$fields: function () {
      json.field({ key: "resources", value: local.resources })
      json.field({ key: "nextCursor", value: local.nextCursor })
    },
  })
  wrapResult: mcp.response.result({ request: input.request, result: local.payload })
}
