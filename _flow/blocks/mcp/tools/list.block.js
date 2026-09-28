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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

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
