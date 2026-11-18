const _flow = {
  sourceVersion: 3,
  inputs: { request: { type: "string", description: "MCP JSON-RPC request body.", default: "{}" } },
  tests: { ping: { input: { request: "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}" } } },
}

function McpServer({ input, config, result }) {
  parseRequest: local.request = mcp.request({ request: input.request, out: "local.request" })
  if3: if (length(local.request) > 0) {
    handleBatch: local.response = mcp.batch({ request: local.request, out: "local.response" })
    return local.response
  }
  handleSingle: local.response = mcp.handle({ request: local.request, out: "local.response" })
  return local.response
}
