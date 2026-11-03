const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "description": "Validates an entity model without writing, with structured diagnostics.",
  "icon": "mdi:database-cog",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "MCP response path."
    },
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Target Convertigo application project."
    },
    "model": {
      "kind": "expression",
      "type": "object",
      "description": "Complete declarative entity model as a JSON object. Data, never evaluated as code."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  }
}

const _flow = { sourceVersion: 2 }

function mcp_tool_flow_entity_model_check({ input, config, result }) {
  mcp.tool.run({ request: input.request, target: "entity.model.check", jsonArguments: { modelJson: "model" } })
}
