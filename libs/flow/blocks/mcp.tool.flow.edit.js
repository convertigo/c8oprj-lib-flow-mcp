(function () {
	return {
		name: "mcp.tool.flow.edit",
		private: true,

		displayName: function () {
			return "tool flow-edit";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var response = ctx.lib("mcp").runToolBlock(ctx, request, {}, function (args) {
				return ctx.lib("mcp").applyNamedFlowMutation(ctx, args);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
