const _meta = {
  "version": 1,
  "private": true,
  "runtime": "rhino",
  "uses": ["mcp", "jwt"],
  "tags": ["mcp", "jwt", "admin"],
  "description": "Lists durable Flow MCP token metadata without exposing token secrets.",
  "properties": {
    "request": { "kind": "expression", "type": "object", "default": "input.request" },
    "out": { "kind": "path", "mode": "write", "default": "local.response" }
  }
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.lib("mcp").requestValue(ctx, props.request);
			var jwt = ctx.lib("jwt");
			var response = jwt.adminResponse(request, jwt.list(ctx));
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
