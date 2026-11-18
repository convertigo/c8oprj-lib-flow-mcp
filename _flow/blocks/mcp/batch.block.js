const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Handles a JSON-RPC batch request.",
  "summary": [
    "handle MCP batch -> {{out}}",
    "handle MCP batch",
  ],
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
  "display": "batch -> ${input.out}",
}

const _flow = { sourceVersion: 3 }

function mcp_batch({ input, config, result }) {
  local.responses = []
  eachRequest: flow.forEach({
    items: input.request,
    $$nodes: function () {
      handleRequest: local.response = mcp.handle({ request: current, out: "local.response" })
      collectResponse: json.push({ path: "local.responses", value: local.response })
    },
  })
  returnValue: return local.responses
}
