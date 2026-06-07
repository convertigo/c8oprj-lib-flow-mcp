const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:reply",
  "uses": [
    "mcp"
  ],
  "description": "Wraps a payload in a JSON-RPC result response.",
  "hooks": {
    "file": "result.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC request object."
    },
    "result": {
      "kind": "expression",
      "type": "object",
      "description": "JSON-RPC result payload expression."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving the JSON-RPC response."
    }
  },
  "runtime": "rhino"
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = ctx.expr(props.request || "input.request") || {};
			var result = ctx.expr(props.result || "({})");
			var response = mcp.finalizeResponse(ctx, request, {
				jsonrpc: "2.0",
				id: request.id === undefined ? null : request.id,
				result: result
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
