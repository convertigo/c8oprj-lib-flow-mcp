const _meta = {
  "version": 1,
  "description": "Handles a JSON-RPC batch request.",
  "icon": "mdi:call-split",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "array",
      "default": "input.request",
      "description": "MCP JSON-RPC request array."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP batch response array."
    }
  },
  "outputs": {
    "out": {
      "type": "unknown"
    }
  },
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "batch -> {{ input.out }}"
}

function mcp_batch({ input, config, result }) {
  const responses = []
  forEach({ id: "eachRequest", items: input.request }) {
    const response = mcp.handle({ id: "handleRequest", request: current })
    json.push({ id: "collectResponse", path: "local.responses", value: response })
  }
  return responses
}
