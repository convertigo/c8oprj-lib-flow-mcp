(function () {
	return {
		name: "mcp.request",
		private: true,

		catalog: function () {
			return {
				name: "mcp.request",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:code-json",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Parses an MCP JSON-RPC request payload."
			};
		},

		displayName: function () {
			return "request";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return mcp.parseRequest(ctx.expr(props.request || "input.request"));
		}
	};
}())
