const _meta = {
  "version": 1,
  "description": "Handles one MCP JSON-RPC request object.",
  "icon": "mdi:router-network",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "current",
      "description": "One MCP JSON-RPC request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving one MCP response."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "handle request -> {{ input.out }}"
}

function mcp_handle({ input, config, result }) {
  if (input.request.__flowMcpAuthenticationError) {
    const response = mcp.response.error({ id: "authenticationError", request: input.request, code: -32001, message: input.request.__flowMcpAuthenticationError.message, data: {
      code: input.request.__flowMcpAuthenticationError.code
    } })
    return response
  }
  if (input.request.method == "initialize") {
    const response = mcp.initialize({ id: "handleInitialize", request: input.request })
    return response
  }
  if (input.request.method == "tools/list") {
    const response = mcp.tools.list({ id: "handleToolsList", request: input.request })
    return response
  }
  if (input.request.method == "tools/call") {
    const response = mcp.tools.call({ id: "handleToolsCall", request: input.request })
    return response
  }
  if (input.request.method == "resources/list") {
    const response = mcp.resources.list({ id: "handleResourcesList", request: input.request })
    return response
  }
  if (input.request.method == "resources/templates/list") {
    const response = mcp.resources.templates.list({ id: "handleResourceTemplatesList", request: input.request })
    return response
  }
  if (input.request.method == "resources/read") {
    const response = mcp.resources.read({ id: "handleResourcesRead", request: input.request })
    return response
  }
  if (input.request.method == "notifications/initialized") {
    const response = mcp.notification({ id: "handleInitializedNotification", request: input.request })
    return response
  }
  if (startsWith(input.request.method, "notifications/")) {
    const response = mcp.notification({ id: "handleNotification", request: input.request })
    return response
  }
  const response = mcp.method.notFound({ id: "methodNotFound", request: input.request })
  return response
}
