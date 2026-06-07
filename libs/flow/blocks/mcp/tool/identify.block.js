const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:tag-search-outline",
  "description": "Extracts the MCP tool name, group and arguments.",
  "hooks": {
    "file": "identify.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "description": "Scope path receiving {name, group, arguments}."
    }
  },
  "runtime": "rhino"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function toolGroup(name) {
		name = String(name || "");
		if (name.match(/^flow-(catalog|analyze|search|context|tree|output-schema)$/) || name.match(/^flow-requestable-/)) {
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
