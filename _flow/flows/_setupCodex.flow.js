// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "inputs": {
    "codexHome": {
      "type": "string",
      "description": "Codex home directory. Leave empty to use ~/.codex.",
      "default": "",
    },
    "mcpUrl": {
      "type": "string",
      "description": "Convertigo Flow MCP endpoint URL. Leave empty to use the current endpoint.",
      "default": "",
    },
    "dryRun": {
      "type": "boolean",
      "description": "Preview files and config changes without writing them.",
      "default": false,
    },
  },
  "tests": {
    "preview": {
      "input": {
        "dryRun": true,
      },
    },
  },
  "sourceVersion": 2,
}

function _setupCodex({ input, config, result }) {
  local.setup = codex.setup({
    $$id: "setup",
    codexHome: input.codexHome,
    mcpUrl: input.mcpUrl,
    dryRun: input.dryRun,
    out: "local.setup",
  })
  return({
    $$id: "returnValue",
    value: local.setup,
  })
}
