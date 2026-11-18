const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Reads one intuitive Flow Svelte source and its revision.",
  "icon": "mdi:file-code-outline",
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
    "revision": {
      "kind": "text",
      "type": "string",
      "description": "Optional expected revision for a bounded read; rejects stale context.",
    },
    "startLine": {
      "kind": "literal",
      "type": "integer",
      "description": "First one-based line for a bounded read; requires endLine.",
    },
    "endLine": {
      "kind": "literal",
      "type": "integer",
      "description": "Last inclusive one-based line for a bounded read; requires startLine, maximum 500 lines.",
    },
    "startChar": {
      "kind": "literal",
      "type": "integer",
      "description": "Zero-based offset for continuing a long single-line source; pass the returned revision.",
    },
    "contractOffset": {
      "kind": "literal",
      "type": "integer",
      "description": "Continue a paginated authoring contract at contractNextOffset with the same revision.",
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

const _flow = { sourceVersion: 3 }

function mcp_tool_frontend_svelte_code_get({ input, config, result }) {
  frontendSvelteCodeGet: mcp.tool.run({
    request: input.request,
    target: "frontend.svelte.source",
    args: { operation: "get" },
  })
}
