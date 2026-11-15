const _meta = {
  "sourceVersion": 2,
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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_resources_list({ input, config, result }) {
  local.resourceList = resource.list({
    $$id: "listResourceFiles",
    rootDir: "_flow/resources",
    pattern: "**/*.md",
  })
  set({
    path: "local.resources",
    value: [],
  })
  forEach({
    $$id: "eachResource",
    items: local.resourceList.resources,
    $$nodes: function () {
      if({
        $$id: "if5",
        condition: !current.uri.startsWith("flow://skills/") && !current.uri.startsWith("flow://ace/"),
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
                  json.field({
                    $$id: "size",
                    key: "size",
                    value: current.size,
                  })
                },
              })
            },
          })
        },
      })
    },
  })
  local.libraryGuides = mcp.resources.library({
    $$id: "libraryGuides",
    $$comment: "Guides shipped by workspace libraries, read with resources/read like the Flow guides.",
    operation: "list",
    out: "local.libraryGuides",
  })
  forEach({
    $$id: "eachLibraryGuide",
    items: local.libraryGuides,
    $$nodes: function () {
      json.push({
        $$id: "pushLibraryGuide",
        path: "local.resources",
        value: current,
      })
    },
  })
  local.experienceResources = mcp.experience({
    request: input.request,
    operation: "list",
    out: "local.experienceResources",
  })
  forEach({
    items: local.experienceResources,
    $$nodes: function () {
      json.push({ path: "local.resources", value: current })
    },
  })
  local.resources = mcp.resources.library({
    $$id: "guideSizes",
    $$comment: "Each guide description ends with its size in KB, computed from its bytes, so a reader can choose the shorter guide.",
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
    by: (local.entryGuides.indexOf(current.uri) >= 0
      ? "0" + local.entryGuides.indexOf(current.uri)
      : current.uri.startsWith("flow://guide/")
        ? current.uri.substring("flow://guide/".length).includes("/") ? "2" : "1"
        : "3") + current.uri,
    direction: "asc",
  })
  // MCP cursors are offsets into the stable, ordered resource list. A small
  // page leaves room for library metadata and the JSON-RPC envelope.
  local.cursor = Number(input.request.params && input.request.params.cursor || 0)
  if({
    condition: !Number.isFinite(local.cursor) || local.cursor < 0 || Math.floor(local.cursor) !== local.cursor,
    $$then: function () { local.cursor = 0 },
  })
  local.nextCursor = local.cursor + 20 < local.resources.length ? String(local.cursor + 20) : null
  local.resources = local.resources.slice(local.cursor, local.cursor + 20)
  local.payload = json.object({
    $$id: "payload",
    $$fields: function () {
      json.field({
        key: "resources",
        value: local.resources,
      })
      json.field({
        key: "nextCursor",
        value: local.nextCursor,
      })
    },
  })
  mcp.response.result({
    $$id: "wrapResult",
    request: input.request,
    result: local.payload,
  })
}
