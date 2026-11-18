const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Searches canonical Flow Svelte sources and returns bounded matching extracts.",
  "icon": "mdi:file-code-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
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
    "frontend",
    "code",
    "search",
  ],
}

const _flow = { sourceVersion: 3 }

function mcp_tool_frontend_svelte_code_rg({ input, config, result }) {
  frontendSvelteCodeRg: mcp.tool.run({
    request: input.request,
    target: "frontend.svelte.source",
    args: { operation: "rg" },
  })
}
