(function () {
	return {
		name: "mcp.notification",
		private: true,

		catalog: function () {
			return {
				name: "mcp.notification",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:bell-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Accepts MCP notifications without a JSON-RPC response."
			};
		},

		displayName: function () {
			return "notification";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.notification(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
