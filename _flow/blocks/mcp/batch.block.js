const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Handles a JSON-RPC batch request.",
  "icon": "mdi:call-split",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "array",
      "default": "input.request",
      "description": "MCP JSON-RPC request array.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP batch response array.",
    },
  },
  "outputs": {
    "out": {
      "type": "array",
      "items": {
        "type": "object",
      },
    },
  },
  "private": true,
  "tags": [
    "mcp",
  ],
  "display": "batch -> {{ input.out }}",
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_batch({ input, config, result }) {
  set({
    $$id: "responses",
    path: "local.responses",
    value: [],
  })
  forEach({
    $$id: "eachRequest",
    items: input.request,
    $$nodes: function () {
      local.response = mcp.handle({
        $$id: "handleRequest",
        request: current,
        out: "local.response",
      })
      json.push({
        $$id: "collectResponse",
        path: "local.responses",
        value: local.response,
      })
    },
  })
  return({
    $$id: "returnValue",
    value: local.responses,
  })
}
