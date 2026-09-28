const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Learns and attaches a schema to a Svelte FullSync action.",
  "icon": "mdi:database-import-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
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
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_frontend_svelte_fullsync_schema({ input, config, result }) {
  mcp.tool.run({
    $$id: "frontendSvelteFullSyncSchema",
    request: input.request,
    target: "frontend.fullsync.schema.attach",
  })
}
