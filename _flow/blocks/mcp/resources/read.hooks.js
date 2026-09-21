(function () {
	return {
		displayName: function () {
			return "resources.read";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
