(function () {
	return {
		displayName: function () {
			return "tool flow-search";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		}
	};
}())
