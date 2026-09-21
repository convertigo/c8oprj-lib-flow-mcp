(function () {
	function read(ctx, value, fallback) {
		if (value === undefined || value === null || value === "") {
			return fallback;
		}
		return typeof value === "string" ? ctx.expr(value) : value;
	}

	return {
		displayName: function (node) {
			var props = node.props || node;
			return "error " + (props.code || "-32000") + " -> " + (props.out || "local.response");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
