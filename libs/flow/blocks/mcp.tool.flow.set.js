(function () {
	return {
		name: "mcp.tool.flow.set",
		private: true,

		displayName: function () {
			return "tool flow-set";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var write = ctx.flowSet(args.name, args.flowSource || "", args);
				write.registration = mcp.registerFlowDbo(args, write);
				return write;
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
