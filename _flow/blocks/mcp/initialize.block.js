const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Builds the MCP initialize response.",
  "icon": "mdi:hand-wave-outline",
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
  "display": "initialize",
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_initialize({ input, config, result }) {
  mcp.response.result({
    $$id: "wrapResult",
    request: input.request,
    result: {
      "protocolVersion": "2025-06-18",
      "serverInfo": {
        "name": "convertigo-flow-mcp",
        "version": "0.1.0",
      },
      "capabilities": {
        "tools": {},
        "resources": {},
      },
    },
  })
}
