const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  runtime: "rhino",
  uses: ["mcp"],
  icon: "mdi:tag-search-outline",
  description: "Adapts authenticated MCP tag commands to the shared Java tag domain.",
  properties: {
    request: { kind: "expression", type: "object", default: "input.request" },
    operation: { kind: "text", type: "string" },
    out: { kind: "path", mode: "write", default: "local.response" },
  },
}

(function () {
  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      var mcp = ctx.lib("mcp");
      var request = mcp.requestValue(ctx, props.request);
      var response;
      try {
        var args = mcp.toolArguments(request);
        var Tags = Packages.com.twinsoft.convertigo.engine.tags;
        var scope = Tags.TagManager.Scope.valueOf(String(args.scope || ""));
        var manager = Tags.TagManager.get();
        var project = args.project ? String(args.project) : null;
        var value;
        if (props.operation === "get") {
          value = manager.read(scope, project, args.referenceProject ? String(args.referenceProject) : null);
          if (String(scope) === "projectObjects") {
            value.set("suggestions", manager.suggestions(project).path("suggestions"));
          }
        } else if (props.operation === "apply") {
          if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
            throw new Error("input must be a tag command object.");
          }
          value = manager.mutate(scope, project, String(args.revision || ""), String(args.action || ""),
            Tags.TagDocument.parseObject(JSON.stringify(args.input)));
        } else {
          throw new Error("Unknown tag tool operation.");
        }
        response = mcp.toolResponse(request, JSON.parse(String(value)), ctx);
      } catch (error) {
        response = mcp.toolError(request, error, ctx);
      }
      ctx.write(props.out || "local.response", response);
      return response;
    },
  };
}())
