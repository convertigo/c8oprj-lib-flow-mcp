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
				response = mcp.toolResponse(request, ctx.callBlock(target, args, { trace: false }), ctx);
			} catch (e) {
				response = mcp.toolError(request, e, ctx);
			}
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
