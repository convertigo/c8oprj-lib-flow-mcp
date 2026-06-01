(function () {
	return {
		name: "mcp.tool.flow.node.delete",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.flow.node.delete",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:playlist-remove",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs the flow-node-delete MCP tool."
			};
		},

		displayName: function () {
			return "tool flow-node-delete";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

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
