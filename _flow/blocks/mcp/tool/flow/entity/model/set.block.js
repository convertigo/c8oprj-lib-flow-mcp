const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "private": true,
  "description": "Validates and atomically writes an interpreted entity model with mandatory revision control. Scaffolds the private app.entityAccess if missing, without overwriting it; reads require authentication by default (publicRead explicitly opens entities), writes stay denied until the application policy opens them. Business Flows call entity.* and need no gateway; gateway: true also creates the project's EntityGateway if missing (hidden, signed-in sessions only) for pages that use EntityTable or EntityForm. Creates no generated CRUD code. The runtime ensures additive schema on first entity use, without an ADMIN initialization facade; follow flow://guide/multipage-entities for role-based applications. The model property gives the format and an example.",
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
    },
    "confirmStorageChange": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "true writes a model that changes or removes how an existing field or entity is stored (type, maxLength, precision, scale, nullable, default). Only for an entity never used yet: a used one refuses the change at its first call, so the model write refuses it first (ENTITY_MODEL_STORAGE_CHANGE, with the declaration to restore)."
    },
    "gateway": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "true only when pages use EntityTable or EntityForm: also creates the project's EntityGateway if missing, hidden and for signed-in sessions. It serves every operation app.entityAccess allows, outside the rules of business Flows. An existing gateway is kept as written."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  }
}

const _flow = { sourceVersion: 3 }

function mcp_tool_flow_entity_model_set({ input, config, result }) {
  mcp.tool.run({ request: input.request, target: "entity.model.set", jsonArguments: { modelJson: "model" } })
}
