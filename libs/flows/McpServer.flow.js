const _flow = {
  inputs: {
    request: {
      type: "string",
      description: "MCP JSON-RPC request body.",
      default: "{}"
    }
  },
  tests: {
    ping: {
      input: {
        request: "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}"
      }
    }
  }
}

function McpServer({ input, config, result }) {
  var request = mcp.request({ id: "parseRequest", request: input.request })
  if (length(request) > 0) {
    var response = mcp.batch({ id: "handleBatch", request: request })
    return response
  }
  var response = mcp.handle({ id: "handleSingle", request: request })
  return response
}
