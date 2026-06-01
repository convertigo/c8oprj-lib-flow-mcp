(function () {
	return {
		name: "mcp.initialize",
		private: true,

		catalog: function () {
			return {
				name: "mcp.initialize",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:hand-wave-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Builds the MCP initialize response."
			};
		},

		displayName: function () {
			return "initialize";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.initialize(ctx, ctx.expr(props.request || "input.request"));
		}
	};
}())
