(function () {
	return {
		displayName: function () {
			return "request";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
