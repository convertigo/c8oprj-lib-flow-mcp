const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:bell-outline",
  "uses": [
    "mcp"
  ],
  "description": "Accepts MCP notifications without a JSON-RPC response.",
  "hooks": {
    "file": "notification.hooks.js"
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
			return mcp.notification(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
