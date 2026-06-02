(function () {
	return {
		displayName: function (node) {
			var props = node.props || node;
			return "result -> " + (props.out || "flow.response");
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		}
	};
}())
