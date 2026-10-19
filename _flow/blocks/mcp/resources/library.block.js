const _meta = {
  sourceVersion: 2,
  version: 1,
  private: true,
  runtime: "rhino",
  uses: ["mcp"],
  icon: "mdi:book-open-variant",
  description: "Lists or reads the guides shipped by workspace libraries (_flow/resources/guide/*.md), as flow://lib/<project>/<guide>.",
  summary: "library guides {{operation}}",
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
      var value;
      if (String(props.operation || "") === "list") {
        value = mcp.libraryGuides().map(function (guide) {
          return { uri: guide.uri, name: guide.name, description: guide.description, mimeType: guide.mimeType };
        });
      } else {
        var request = mcp.requestValue(ctx, props.request);
        var uri = String(request && request.params && request.params.uri || "");
        var text = mcp.libraryGuideText(uri);
        value = mcp.finalizeResponse(ctx, request, text === null
          ? mcp.jsonRpcError(request.id, -32000, "Unknown Flow MCP resource: " + uri, { code: "FLOW_MCP_RESOURCE_ERROR" })
          : mcp.jsonRpcResult(request.id, { contents: [{ uri: uri, mimeType: "text/markdown", text: text }] }));
      }
      ctx.write(props.out || "local.response", value);
      return value;
    }
  };
}())
