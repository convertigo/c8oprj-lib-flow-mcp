(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function toolGroup(name) {
		name = String(name || "");
		if (name.match(/^flow-(catalog|analyze|search|context|tree|output-schema)$/)) {
			return "inspect";
		}
		if (name.match(/^flow-(resource|block|type)-/) && name !== "flow-block-test") {
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
		displayName: function () {
			return "identify MCP tool";
		},

		analyze: function (ctx, node) {
			var out = ctx.props(node).out;
			if (out) {
				ctx.addPath(out);
			}
		}
	};
}())
