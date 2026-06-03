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
				var patch = args.properties || {};
				patch = JSON.parse(JSON.stringify(patch));
				if (args.newId || args.newNodeId) {
					patch.id = String(args.newId || args.newNodeId);
				}
				if (!patch.id) {
					throw new Error("flow-node-duplicate requires newId or properties.id to avoid duplicate node ids.");
				}
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "copy",
					fromNodeId: args.nodeId,
					patch: patch
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
