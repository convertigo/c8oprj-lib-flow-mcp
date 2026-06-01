(function () {
	return {
		name: "mcp.tool.flow.edit",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.flow.edit",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:sitemap-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs the flow-edit MCP tool."
			};
		},

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
