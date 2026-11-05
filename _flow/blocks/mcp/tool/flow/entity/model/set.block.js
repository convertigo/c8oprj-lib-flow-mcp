const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "description": "Validates and atomically writes an interpreted entity model with mandatory revision control. Creates no generated CRUD code. The runtime ensures additive schema on first entity use, without an ADMIN initialization facade; follow flow://guide/multipage-entities for role-based applications.",
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
    },
    "expectedRevision": {
      "kind": "text",
      "type": "string",
      "description": "Required SHA-256 returned by get, or missing for first creation. Stale revisions are refused."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  }
}

const _flow = { sourceVersion: 2 }

function mcp_tool_flow_entity_model_set({ input, config, result }) {
  mcp.tool.run({ request: input.request, target: "entity.model.set", jsonArguments: { modelJson: "model" } })
}
