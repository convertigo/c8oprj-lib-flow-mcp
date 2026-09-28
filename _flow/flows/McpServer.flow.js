// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

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
  local.request = mcp.request({
    $$id: "parseRequest",
    request: input.request,
    out: "local.request",
  })
  if({
    $$id: "if3",
    condition: length(local.request) > 0,
    $$then: function () {
      local.response = mcp.batch({
        $$id: "handleBatch",
        request: local.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  local.response = mcp.handle({
    $$id: "handleSingle",
    request: local.request,
    out: "local.response",
  })
  return({
    $$id: "returnValue",
    value: local.response,
  })
}
