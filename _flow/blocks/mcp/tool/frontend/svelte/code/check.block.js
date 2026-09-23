const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Parses and validates one complete Flow Svelte source without writing it.",
  "icon": "mdi:file-check-outline",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
    },
    "sourceFile": {
      "kind": "text",
      "type": "string",
      "description": "Optional project-relative *.flow.svelte or *.flow.css path; defaults to the configured modelPath.",
    },
    "code": {
      "kind": "text",
      "type": "string",
      "description": "Complete .flow.svelte draft. Omit to check the saved source.",
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
  ],
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_frontend_svelte_code_check({ input, config, result }) {
  mcp.tool.run({
    $$id: "frontendSvelteCodeCheck",
    request: input.request,
    target: "frontend.svelte.source",
    args: {
      operation: "check",
    },
  })
}
