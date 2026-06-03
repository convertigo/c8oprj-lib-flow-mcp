(function () {
	return {
		displayName: function () {
			return "notification";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
