(function () {
	return {
		name: "mcp.notification",
		private: true,

		displayName: function () {
			return "notification";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.notification(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
