const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "description": "Reads the interpreted entity model and its SHA-256 revision. Default data route for persisted business data with roles: reference lib_flow_entity and follow flow://guide/entities then flow://guide/multipage-entities.",
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
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  }
}

const _flow = { sourceVersion: 2 }

function mcp_tool_flow_entity_model_get({ input, config, result }) {
  mcp.tool.run({ request: input.request, target: "entity.model.get" })
}
