(function () {
	return {
		displayName: function () {
			return "tool flow-node-delete";
		},

		analyze: function (ctx, node) {
			ctx.addPath(ctx.props(node).out);
		}
	};
}())
