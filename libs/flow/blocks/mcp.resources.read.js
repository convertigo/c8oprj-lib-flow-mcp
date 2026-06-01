(function () {
	return {
		name: "mcp.resources.read",
		private: true,

		catalog: function () {
			return {
				name: "mcp.resources.read",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:book-open-variant",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Builds the MCP resources/read response."
			};
		},

		displayName: function () {
			return "resources.read";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.resourcesRead(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
