(function () {
	function nodeFromArgs(args) {
		var node = args.node ? JSON.parse(JSON.stringify(args.node)) : {};
		if (args.id !== undefined && args.id !== null && String(args.id) !== "") {
			node.id = String(args.id);
		}
		if (args.block !== undefined && args.block !== null && String(args.block) !== "") {
			node.block = String(args.block);
		}
		var props = args.properties || {};
		Object.keys(props).forEach(function (key) {
			node[key] = props[key];
		});
		if (!node.block) {
			throw new Error("flow-node-add requires block or node.block.");
		}
		if (!node.id) {
			throw new Error("flow-node-add requires id or node.id for stable future edits.");
		}
		return node;
	}

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
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "insert",
					value: nodeFromArgs(args)
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
