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
		name: "mcp.tool.flow.node.duplicate",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.flow.node.duplicate",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:playlist-plus",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs the flow-node-duplicate MCP tool."
			};
		},

		displayName: function () {
			return "tool flow-node-duplicate";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var patch = args.properties || args.props || {};
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
