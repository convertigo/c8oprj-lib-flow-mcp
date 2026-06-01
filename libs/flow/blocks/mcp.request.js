(function () {
	return {
		name: "mcp.request",
		private: true,

		displayName: function () {
			return "request";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.parseRequest(ctx.expr(props.request || "input.request"));
		}
	};
}())
