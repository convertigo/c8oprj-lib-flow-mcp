(function () {
	function position(args, mutation) {
		["beforeNodeId", "afterNodeId", "parentNodeId", "slot", "index"].forEach(function (key) {
			if (args[key] !== undefined && args[key] !== null && String(args[key]) !== "") {
				mutation[key] = args[key];
			}
		});
		return mutation;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				if (!args.beforeNodeId && !args.afterNodeId && !args.parentNodeId && args.index === undefined) {
					throw new Error("flow-node-move requires beforeNodeId, afterNodeId, parentNodeId or index.");
				}
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "move",
					fromNodeId: args.nodeId
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
