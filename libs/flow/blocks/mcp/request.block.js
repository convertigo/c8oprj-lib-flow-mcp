const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:code-json",
  "uses": [
    "mcp",
    "jwt"
  ],
  "description": "Parses an MCP JSON-RPC request payload.",
  "hooks": {
    "file": "request.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the MCP response."
    }
  },
  "runtime": "rhino"
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var jwt = ctx.lib("jwt");
			var request = mcp.parseRequest(mcp.requestValue(ctx, props.request), ctx);
			return jwt.guardRequest(ctx, request);
		}
	};
}())
