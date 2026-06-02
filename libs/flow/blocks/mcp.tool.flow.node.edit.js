(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var mutation;
				if (args.property !== undefined && args.property !== null && String(args.property) !== "") {
					mutation = {
						op: "replace",
						nodeId: args.nodeId,
						property: args.property,
						value: args.value
					};
				} else {
					var patch = args.properties || args.props;
					if (!patch || typeof patch !== "object") {
						throw new Error("flow-node-edit requires property+value or properties.");
					}
					mutation = {
						op: "merge",
						nodeId: args.nodeId,
						value: patch
					};
				}
				return mcp.applyNodeMutation(ctx, args, mutation);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
