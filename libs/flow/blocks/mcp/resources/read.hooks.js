(function () {
	var resources = {
		"flow://guide/start": {
			path: "libs/flow/resources/guide/start.md",
			mimeType: "text/markdown"
		},
		"flow://guide/authoring": {
			path: "libs/flow/resources/guide/authoring.md",
			mimeType: "text/markdown"
		},
		"flow://guide/search-and-edit": {
			path: "libs/flow/resources/guide/search-and-edit.md",
			mimeType: "text/markdown"
		},
		"flow://guide/custom-blocks": {
			path: "libs/flow/resources/guide/custom-blocks.md",
			mimeType: "text/markdown"
		}
	};

	function jsonRpcResult(id, result) {
		return {
			jsonrpc: "2.0",
			id: id === undefined ? null : id,
			result: result
		};
	}

	function jsonRpcError(id, code, message, data) {
		var error = {
			code: code,
			message: String(message)
		};
		if (data !== undefined && data !== null) {
			error.data = data;
		}
		return {
			jsonrpc: "2.0",
			id: id === undefined ? null : id,
			error: error
		};
	}

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
