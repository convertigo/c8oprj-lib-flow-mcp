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
		name: "mcp.tool.flow.node.move",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.flow.node.move",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:playlist-play",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs the flow-node-move MCP tool."
			};
		},

		displayName: function () {
			return "tool flow-node-move";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

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
