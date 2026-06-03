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
			ctx.write(props.out || "flow.response", response);
			return response;
		}
	};
}())
