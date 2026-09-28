const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Runs the frontend-svelte-asset-import MCP tool.",
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
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_frontend_svelte_asset_import({ input, config, result }) {
  mcp.tool.run({
    $$id: "frontendSvelteAssetImport",
    request: input.request,
    target: "frontend.asset.import",
  })
}
