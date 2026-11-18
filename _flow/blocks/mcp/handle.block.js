const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Handles one MCP JSON-RPC request object.",
  "summary": [
    "handle MCP request -> {{out}}",
    "handle MCP request",
  ],
  "icon": "mdi:router-network",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "current",
      "description": "One MCP JSON-RPC request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving one MCP response.",
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
  "display": "handle request -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_handle({ input, config, result }) {
  ifProtocolError: if (input.request.__flowMcpProtocolError) {
    local.protocolResponse = mcp.response.error({
      request: input.request,
      code: input.request.__flowMcpProtocolError.code,
      message: input.request.__flowMcpProtocolError.message,
    })
    return local.protocolResponse
  }
  if (input.request.__flowMcpAuthenticationError) {
    authenticationError: local.response = mcp.response.error({
      request: input.request,
      code: -32001,
      message: input.request.__flowMcpAuthenticationError.message,
      data: input.request.__flowMcpAuthenticationError,
      out: "local.response",
    })
    return local.response
  }
  ifPing: if (input.request.method == "ping") {
    handlePing: local.response = mcp.response.result({ request: input.request, result: {} })
    returnPing: return local.response
  }
  if8: if (input.request.method == "initialize") {
    handleInitialize: local.response = mcp.initialize({ request: input.request, out: "local.response" })
    return local.response
  }
  if12: if (input.request.method == "tools/list") {
    handleToolsList: local.response = mcp.tools.list({ request: input.request, out: "local.response" })
    return local.response
  }
  if16: if (input.request.method == "tools/call") {
    handleToolsCall: local.response = mcp.tools.call({ request: input.request, out: "local.response" })
    return local.response
  }
  if20: if (input.request.method == "resources/list") {
    handleResourcesList: local.response = mcp.resources.list({ request: input.request, out: "local.response" })
    return local.response
  }
  if24: if (input.request.method == "resources/templates/list") {
    handleResourceTemplatesList: local.response = mcp.resources.templates.list({
      request: input.request,
      out: "local.response",
    })
    return local.response
  }
  if28: if (input.request.method == "resources/read") {
    handleResourcesRead: local.response = mcp.resources.read({ request: input.request, out: "local.response" })
    return local.response
  }
  if32: if (input.request.method == "notifications/initialized") {
    handleInitializedNotification: local.response = mcp.notification({ request: input.request, out: "local.response" })
    return local.response
  }
  if36: if (startsWith(input.request.method, "notifications/")) {
    handleNotification: local.response = mcp.notification({ request: input.request, out: "local.response" })
    return local.response
  }
  methodNotFound: local.response = mcp.method.notFound({ request: input.request, out: "local.response" })
  return local.response
}
