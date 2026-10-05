const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  runtime: "rhino",
  description: "Reads the MCP server identity from its current Convertigo project.",
  properties: {
    out: { kind: "path", mode: "write", default: "local.serverInfo" },
  },
  outputs: { out: { type: "object" } },
}

(function () {
  return {
    run: function (ctx, node) {
      var context = null;
      try { context = ctx.convertigoContext(); }
      catch (error) { if (error.code !== "CONVERTIGO_CONTEXT_UNAVAILABLE") throw error; }
      var project = context && context.project;
      var info = { name: "convertigo-flow-mcp", version: project ? String(project.getVersion()) : "development" };
      ctx.write(ctx.props(node).out || "local.serverInfo", info);
      return info;
    },
  };
}())
