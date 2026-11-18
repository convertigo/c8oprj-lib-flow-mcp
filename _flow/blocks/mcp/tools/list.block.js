const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Builds the MCP tools/list response.",
  "summary": [
    "tools/list -> {{out}}",
    "tools/list",
  ],
  "icon": "mdi:format-list-bulleted-square",
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
  "display": "tools.list -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_tools_list({ input, config, result }) {
  // The descriptors change with the blocks, the MCP library and the relayed catalog of the caller only.
  keptToolsList: mcp.stable({
    $$out: "local.response",
    request: input.request,
    out: "local.response",
    $$nodes: function () {
      availableTools: local.tools = mcp.tools.available({ out: "local.tools" })
      json.object({
        $$out: "local.payload",
        $$fields: function () {
          tools: json.field({ key: "tools", value: local.tools })
        },
      })
      response: local.response = mcp.response.result({
        request: input.request,
        result: local.payload,
        out: "local.response",
      })
    },
  })
  returnResponse: return local.response
}
