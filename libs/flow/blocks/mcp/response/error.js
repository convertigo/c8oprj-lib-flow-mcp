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
