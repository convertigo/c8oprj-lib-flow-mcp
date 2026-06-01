(function () {
	return {
		name: "mcp.response.result",
		private: true,

		catalog: function () {
			return {
				name: "mcp.response.result",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:reply",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC request object." },
					result: { kind: "expression", type: "object", description: "JSON-RPC result payload expression." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the JSON-RPC response." }
				},
				description: "Wraps a payload in a JSON-RPC result response."
			};
		},

		displayName: function (node) {
			var props = node.props || node;
			return "result -> " + (props.out || "flow.response");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request") || {};
			var result = ctx.expr(props.result || "({})");
			var response = {
				jsonrpc: "2.0",
				id: request.id === undefined ? null : request.id,
				result: result
			};
			ctx.write(props.out || "flow.response", response);
			return response;
		}
	};
}())
