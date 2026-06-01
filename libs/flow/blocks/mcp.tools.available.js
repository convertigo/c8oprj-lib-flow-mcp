(function () {
	return {
		name: "mcp.tools.available",

		displayName: function (node) {
			var props = node.props || node;
			return "available tools -> " + (props.out || "local.tools");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var tools = ctx.lib("mcp").tools();
			ctx.write(props.out || "local.tools", tools);
			return tools;
		}
	};
}())
