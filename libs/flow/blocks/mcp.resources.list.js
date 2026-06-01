(function () {
	return {
		name: "mcp.resources.list",
		private: true,

		catalog: function () {
			return {
				name: "mcp.resources.list",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:book-open-page-variant-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Builds the MCP resources/list response."
			};
		},

		displayName: function () {
			return "resources.list";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.resourcesList(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
