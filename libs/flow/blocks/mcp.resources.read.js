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
		name: "mcp.resources.read",
		private: true,

		displayName: function () {
			return "resources.read";
		},

		analyze: function (ctx, node) {
			var props = ctx.props(node);
			ctx.addPath(props.out);
		},

		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = ctx.expr(props.request || "input.request") || {};
			var uri = String(request.params && request.params.uri || "");
			try {
				var resource = resources[uri];
				if (!resource) {
					throw new Error("Unknown Flow MCP resource: " + uri);
				}
				var content = ctx.resourceGet({
					path: resource.path
				}).content;
				var response = mcp.finalizeResponse(ctx, request, jsonRpcResult(request.id, {
					contents: [{
						uri: uri,
						mimeType: resource.mimeType,
						text: content
					}]
				}));
				ctx.write(props.out || "local.response", response);
				return response;
			} catch (e) {
				var error = mcp.finalizeResponse(ctx, request, jsonRpcError(request.id, -32000, String(e.message || e), {
					code: "FLOW_MCP_RESOURCE_ERROR"
				}));
				ctx.write(props.out || "local.response", error);
				return error;
			}
		}
	};
}())
