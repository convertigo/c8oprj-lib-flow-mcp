const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:alert-circle-outline",
  "uses": [
    "mcp"
  ],
  "description": "Wraps an error in a JSON-RPC error response.",
  "hooks": {
    "file": "error.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC request object."
    },
    "code": {
      "kind": "expression",
      "type": "number",
      "description": "JSON-RPC error code."
    },
    "message": {
      "kind": "expression",
      "type": "string",
      "description": "JSON-RPC error message."
    },
    "data": {
      "kind": "expression",
      "type": "object",
      "description": "Optional JSON-RPC error data."
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
	function read(ctx, value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return typeof value === "string" ? ctx.expr(value) : value;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = read(ctx, props.request, {}) || {};
			var code = read(ctx, props.code, -32000);
			var message = read(ctx, props.message, "Flow MCP error");
			var data = read(ctx, props.data, undefined);
			var error = {
				code: code,
				message: String(message)
			};
			if (data !== undefined && data !== null) {
				error.data = data;
			}
			var response = mcp.finalizeResponse(ctx, request, {
				jsonrpc: "2.0",
				id: request.id === undefined ? null : request.id,
				error: error
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
