const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds the MCP tools/list response.",
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
  "display": "tools.list -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tools_list({ input, config, result }) {
  local.tools = mcp.tools.available({
    $$id: "availableTools",
    out: "local.tools",
  })
  local.payload = json.object({
    $$id: "payload",
    $$fields: function () {
      json.field({
        $$id: "tools",
        key: "tools",
        value: local.tools,
      })
    },
  })
  mcp.response.result({
    $$id: "response",
    request: input.request,
    result: local.payload,
  })
}
