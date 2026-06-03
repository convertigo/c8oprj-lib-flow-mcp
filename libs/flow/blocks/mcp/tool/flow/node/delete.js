(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var response = ctx.lib("mcp").runToolBlock(ctx, request, {}, function (args) {
				return ctx.lib("mcp").applyNodeMutation(ctx, args, {
					op: "delete",
					nodeId: args.nodeId
				});
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
