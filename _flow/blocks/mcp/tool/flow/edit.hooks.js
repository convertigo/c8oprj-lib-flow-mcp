(function () {
	return {
		displayName: function () {
			return "tool flow-edit";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		}
	};
}())
