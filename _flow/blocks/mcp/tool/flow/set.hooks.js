(function () {
	return {
		displayName: function () {
			return "tool flow-set";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		}
	};
}())
