// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "inputs": {
    "request": {
      "type": "string",
      "description": "MCP JSON-RPC request body.",
      "default": "{}",
    },
  },
  "tests": {
    "ping": {
      "input": {
        "request": "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}",
      },
    },
  },
  "sourceVersion": 2,
}

function McpServer({ input, config, result }) {
  mcp.request({
    $$id: "parseRequest",
    $$out: "local.request",
    request: input.request,
    out: "local.request",
  })
  if({
    $$id: "if3",
    condition: length(local.request) > 0,
    $$then: function () {
      mcp.batch({
        $$id: "handleBatch",
        $$out: "local.response",
        request: local.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  mcp.handle({
    $$id: "handleSingle",
    $$out: "local.response",
    request: local.request,
    out: "local.response",
  })
  return({
    $$id: "returnValue",
    value: local.response,
  })
}
