(function () {
	return {
		displayName: function (node) {
			var props = node.props || node;
			return "result -> " + (props.out || "local.response");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
