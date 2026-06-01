(function () {
	return {
		name: "mcp.tool.identify",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.identify",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:tag-search-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving {name, group, arguments}." }
				},
				description: "Extracts the MCP tool name, group and arguments."
			};
		},

		displayName: function () {
			return "tool.identify";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			return ctx.write(props.out, mcp.toolInfo(ctx.expr(props.request || "input.request")));
		}
	};
}())
