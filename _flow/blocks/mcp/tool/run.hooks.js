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
		displayName: function (node) {
			return "run " + (prop(node, "target") || "tool");
		},

		analyze: function (ctx, node) {
			var out = ctx.props(node).out;
			if (out) {
				ctx.addPath(out);
			}
		}
	};
}())
