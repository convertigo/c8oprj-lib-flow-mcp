function _setupCodex({ input, config, result }) {
  var setup = codex.setup({ id: "setup", codexHome: input.codexHome, mcpUrl: input.mcpUrl, dryRun: input.dryRun })
  return setup
}
