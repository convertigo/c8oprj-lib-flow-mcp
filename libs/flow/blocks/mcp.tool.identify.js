(function () {
	return {
		name: "mcp.tool.identify",
		private: true,

		displayName: function () {
			return "tool.identify";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return ctx.write(props.out, mcp.toolInfo(ctx.expr(props.request || "input.request")));
		}
	};
}())
