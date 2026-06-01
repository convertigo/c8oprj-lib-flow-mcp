(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function boolProp(value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		if (typeof value === "boolean") {
			return value;
		}
		return String(value) === "true";
	}

	function targetName(ctx, value) {
		if (value === undefined || value === null) {
			return "";
		}
		value = String(value);
		return value.indexOf("{{") === -1 ? value : ctx.render(value);
	}

	function merge(target, source) {
		target = target || {};
		source = source || {};
		Object.keys(source).forEach(function (key) {
			target[key] = source[key];
		});
		return target;
	}

	function extraArgs(ctx, value) {
		if (value === undefined || value === null || value === "") {
			return {};
		}
		if (typeof value === "string") {
			return ctx.expr(value) || {};
		}
		return ctx.template(value) || {};
	}

	return {
		name: "mcp.tool.run",
		private: true,

		catalog: function () {
			return {
				name: "mcp.tool.run",
				"package": "lib_flow_mcp",
				namespace: "mcp",
				private: true,
				icon: "mdi:play-box-outline",
				props: {
					request: { kind: "expression", type: "object", description: "MCP JSON-RPC tools/call request object." },
					target: { kind: "text", type: "string", description: "Flow block capability called with prepared MCP arguments." },
					args: { kind: "template", type: "object", description: "Optional argument overrides merged after MCP arguments." },
					workspaceSearch: { kind: "literal", type: "boolean", description: "Allow workspace search without resolving a project." },
					resolveProject: { kind: "literal", type: "boolean", description: "Resolve project/projectDir before calling the target block. Default true." },
					out: { kind: "path", mode: "write", description: "Scope path receiving the MCP response." }
				},
				description: "Runs one MCP tool by calling a Flow block capability and wrapping the JSON-RPC response."
			};
		},

		displayName: function (node) {
			return "run " + (prop(node, "target") || "tool");
		},

		analyze: function (ctx, node) {
			var out = ctx.props(node).out;
			if (out) {
				ctx.addPath(out);
			}
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = ctx.expr(props.request || "input.request") || {};
			var target = targetName(ctx, props.target);
			var response;
			try {
				var args = mcp.prepareToolArguments(ctx, request, {
					workspaceSearch: boolProp(props.workspaceSearch, false),
					resolveProject: boolProp(props.resolveProject, true)
				});
				merge(args, extraArgs(ctx, props.args));
				response = mcp.toolResponse(request, ctx.callBlock(target, { props: args }, { trace: false }));
			} catch (e) {
				response = mcp.toolError(request, e);
			}
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
