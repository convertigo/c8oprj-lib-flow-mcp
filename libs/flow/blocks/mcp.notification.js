(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.notification(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
