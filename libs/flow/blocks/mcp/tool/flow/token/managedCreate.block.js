const _meta = {
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": ["mcp", "jwt"],
  "tags": ["mcp", "jwt", "admin"],
  "description": "Creates a short-lived Flow MCP bearer token for the integrated Assistant and Agent Bridge.",
  "properties": {
    "request": { "kind": "expression", "type": "object", "default": "input.request" },
    "out": { "kind": "path", "mode": "write", "default": "local.response" }
  }
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var args = mcp.toolArguments(request);
			var jwt = ctx.lib("jwt");
			var response = jwt.adminResponse(request, jwt.createManaged(ctx, args.label, args.ttlSeconds));
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
