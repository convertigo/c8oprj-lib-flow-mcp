(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function toolGroup(name) {
		name = String(name || "");
		if (name.match(/^flow-(catalog|analyze|search|context|tree|output-schema)$/)) {
			return "inspect";
		}
		if (name.match(/^flow-(resource|block|code|type)-/) && name !== "flow-block-test") {
			return "source";
		}
		if (name.match(/^flow-(run|test|block-test)$/)) {
			return "runtime";
		}
		if (name.match(/^flow-(list|get|set|apply|edit|node-|schema-reset)/)) {
			return "author";
		}
		return "unknown";
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(prop(node, "request") || "input.request") || {};
			var params = request.params || {};
			var tool = {
				name: String(params.name || ""),
				group: toolGroup(params.name),
				arguments: params.arguments || {}
			};
			ctx.write(props.out || "local.tool", tool);
			return tool;
		}
	};
}())
