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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

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
