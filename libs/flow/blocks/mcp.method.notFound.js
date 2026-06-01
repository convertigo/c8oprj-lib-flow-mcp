(function () {
	return {
		name: "mcp.method.notFound",
		private: true,

		catalog: function () {
			return {
				name: "mcp.method.notFound",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:alert-circle-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Builds a JSON-RPC method-not-found error."
			};
		},

		displayName: function () {
			return "method.notFound";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.methodNotFound(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
