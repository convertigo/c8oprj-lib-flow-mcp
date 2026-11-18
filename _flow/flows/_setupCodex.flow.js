const _flow = {
  sourceVersion: 3,
  inputs: {
    codexHome: { type: "string", description: "Codex home directory. Leave empty to use ~/.codex.", default: "" },
    mcpUrl: {
      type: "string",
      description: "Convertigo Flow MCP endpoint URL. Leave empty to use the current endpoint.",
      default: "",
    },
    dryRun: { type: "boolean", description: "Preview files and config changes without writing them.", default: false },
  },
  tests: { preview: { input: { dryRun: true } } },
}

function _setupCodex({ input, config, result }) {
  local.setup = codex.setup({
    codexHome: input.codexHome,
    mcpUrl: input.mcpUrl,
    dryRun: input.dryRun,
    out: "local.setup",
  })
  returnValue: return local.setup
}
