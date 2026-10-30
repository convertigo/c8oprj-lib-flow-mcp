(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	return {
		displayName: function (node) {
			return "stable -> " + (prop(node, "out") || "local.response");
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out || "local.response");
		}
	};
}())
