(function () {
	return {
		name: "mcp.tool.notFound",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.notFound",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:alert-circle-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Builds an MCP unknown-tool error response."
			};
		},

		displayName: function () {
			return "tool not found";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request") || {};
			var name = request.params && request.params.name || "";
			var response = ctx.lib("mcp").jsonRpcError(request.id, -32000, "Unknown Flow MCP tool: " + name, {
				code: "FLOW_MCP_TOOL_ERROR"
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
