const _meta = {
  "version": 1,
  "description": "Runs the frontend-svelte-asset-import MCP tool.",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "tags": ["mcp"]
}

function mcp_tool_frontend_svelte_asset_import({ input, config, result }) {
  mcp.tool.run({ id: "frontendSvelteAssetImport", request: input.request, target: "frontend.asset.import" })
}
