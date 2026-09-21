(function () {
	return {
		displayName: function () {
			return "tool flow-node-edit";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		}
	};
}())
