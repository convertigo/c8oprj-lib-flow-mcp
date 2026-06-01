(function () {
	return {
		name: "mcp.tool.flow.search",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.flow.search",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:magnify-scan",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs the flow-search MCP tool."
			};
		},

		displayName: function () {
			return "tool flow-search";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, { workspaceSearch: true }, function (args) {
				if (String(args.scope || "") === "workspace" && !args.project && !args.projectDir) {
					return mcp.searchWorkspace(ctx, args);
				}
				return ctx.searchFlow(args);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
