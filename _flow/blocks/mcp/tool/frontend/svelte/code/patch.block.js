const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Applies a revision-checked unified patch to one Flow Svelte source.",
  "icon": "mdi:source-branch-sync",
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
      "description": "Revision from code-get; rejects stale patches.",
    },
    "codepatch": {
      "kind": "text",
      "type": "string",
      "description": "Git-style unified diff against the retrieved source, with numbered @@ -old,count +new,count @@ hunk headers.",
    },
    "reveal": {
      "kind": "literal",
      "type": "boolean",
      "default": false,
      "description": "Refresh and reveal the affected source in the Studio project tree.",
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

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function mcp_tool_frontend_svelte_code_patch({ input, config, result }) {
  mcp.tool.run({
    $$id: "frontendSvelteCodePatch",
    request: input.request,
    target: "frontend.svelte.source",
    args: {
      operation: "patch",
      reveal: input.reveal,
    },
  })
}
