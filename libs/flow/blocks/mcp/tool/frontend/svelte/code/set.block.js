const _meta = {
  "version": 1,
  "description": "Validates and writes one complete Flow Svelte source.",
  "icon": "mdi:content-save-check-outline",
  "properties": {
    "request": { "kind": "expression", "type": "object", "default": "input.request" },
    "sourceFile": { "kind": "text", "type": "string", "description": "Optional project-relative *.flow.svelte or *.flow.css path; defaults to the configured modelPath." },
    "code": { "kind": "text", "type": "string", "description": "Complete .flow.svelte source to validate and write." },
    "revision": { "kind": "text", "type": "string", "description": "Current revision from code-get, required for an existing source; omit only to create a missing source." },
    "reveal": { "kind": "literal", "type": "boolean", "default": false, "description": "Refresh and reveal the affected source in the Studio project tree." },
    "out": { "kind": "path", "mode": "write", "default": "local.response" }
  },
  "outputs": { "out": { "type": "object" } },
  "private": true,
  "tags": ["mcp", "frontend", "code"]
}

function mcp_tool_frontend_svelte_code_set({ input, config, result }) {
  mcp.tool.run({ id: "frontendSvelteCodeSet", request: input.request, target: "frontend.svelte.source", args: { operation: "set", reveal: input.reveal } })
}
