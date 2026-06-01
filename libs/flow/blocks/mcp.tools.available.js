(function () {
	return {
		name: "mcp.tools.available",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tools.available",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:format-list-checks",
				props: {
					out: { kind: "path", mode: "write", description: "Scope path receiving the tool descriptors." }
				},
				description: "Returns the Flow MCP tool descriptors."
			};
		},

		displayName: function (node) {
			var props = node.props || node;
			return "available tools -> " + (props.out || "local.tools");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var tools = ctx.lib("mcp").tools();
			ctx.write(props.out || "local.tools", tools);
			return tools;
		}
	};
}())
