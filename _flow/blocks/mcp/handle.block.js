const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Handles one MCP JSON-RPC request object.",
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
  "display": "handle request -> {{ input.out }}",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_handle({ input, config, result }) {
  if({
    $$id: "if2",
    condition: input.request.__flowMcpAuthenticationError,
    $$then: function () {
      mcp.response.error({
        $$id: "authenticationError",
        $$out: "local.response",
        request: input.request,
        code: -32001,
        message: input.request.__flowMcpAuthenticationError.message,
        data: {
          "code": "{{ input.request.__flowMcpAuthenticationError.code }}",
        },
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if8",
    condition: input.request.method == "initialize",
    $$then: function () {
      mcp.initialize({
        $$id: "handleInitialize",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if12",
    condition: input.request.method == "tools/list",
    $$then: function () {
      mcp.tools.list({
        $$id: "handleToolsList",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if16",
    condition: input.request.method == "tools/call",
    $$then: function () {
      mcp.tools.call({
        $$id: "handleToolsCall",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if20",
    condition: input.request.method == "resources/list",
    $$then: function () {
      mcp.resources.list({
        $$id: "handleResourcesList",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if24",
    condition: input.request.method == "resources/templates/list",
    $$then: function () {
      mcp.resources.templates.list({
        $$id: "handleResourceTemplatesList",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if28",
    condition: input.request.method == "resources/read",
    $$then: function () {
      mcp.resources.read({
        $$id: "handleResourcesRead",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if32",
    condition: input.request.method == "notifications/initialized",
    $$then: function () {
      mcp.notification({
        $$id: "handleInitializedNotification",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  if({
    $$id: "if36",
    condition: startsWith(input.request.method, "notifications/"),
    $$then: function () {
      mcp.notification({
        $$id: "handleNotification",
        $$out: "local.response",
        request: input.request,
        out: "local.response",
      })
      return({
        $$id: "returnValue",
        value: local.response,
      })
    },
  })
  mcp.method.notFound({
    $$id: "methodNotFound",
    $$out: "local.response",
    request: input.request,
    out: "local.response",
  })
  return({
    $$id: "returnValue",
    value: local.response,
  })
}
