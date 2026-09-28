const _meta = {
  "sourceVersion": 2,
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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_frontend_svelte_code_rg({ input, config, result }) {
  mcp.tool.run({
    $$id: "frontendSvelteCodeRg",
    request: input.request,
    target: "frontend.svelte.source",
    args: {
      operation: "rg",
    },
  })
}
