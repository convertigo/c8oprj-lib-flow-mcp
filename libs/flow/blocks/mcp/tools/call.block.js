const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:tools",
  "tags": [
    "mcp"
  ],
  "description": "Dispatches one MCP tools/call request by visible tool family.",
  "display": "tools.call -> {{ input.out }}",
  "hooks": {
    "file": "call.hooks.js"
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "runtime": "rhino"
}

(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
	var CODE_TOOL_PREFIX = "mcp.tool.code.";
	var AUTHORING_TOOL_PREFIX = "mcp.tool.authoring.";
	var FRONTEND_TOOL_PREFIX = "mcp.tool.frontend.";

	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function camelToKebab(value) {
		return String(value || "")
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.replace(/\./g, "-")
			.toLowerCase();
	}

	function toolName(blockName) {
		blockName = String(blockName || "");
		if (blockName.indexOf(CODE_TOOL_PREFIX) === 0) {
			return "code-" + camelToKebab(blockName.substring(CODE_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(AUTHORING_TOOL_PREFIX) === 0) {
			return "authoring-" + camelToKebab(blockName.substring(AUTHORING_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(FRONTEND_TOOL_PREFIX) === 0) {
			return "frontend-" + camelToKebab(blockName.substring(FRONTEND_TOOL_PREFIX.length));
		}
		if (blockName.indexOf(TOOL_PREFIX) === 0) {
			var flowName = "flow-" + camelToKebab(blockName.substring(TOOL_PREFIX.length));
			return /^flow-(?:block-)?code-/.test(flowName) ? "" : flowName;
		}
		return "";
	}

	function toolMap(ctx) {
		var map = {};
		var blockIds = typeof ctx.blockNames === "function"
			? ctx.blockNames()
			: (ctx.blockList({ includePrivate: true, detail: "summary" }).blocks || []).map(function (block) {
				return block.block || block.blockId || block.name;
			});
		blockIds.forEach(function (blockId) {
			var name = toolName(blockId);
			if (name) {
				map[name] = blockId;
			}
		});
		return map;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var name = String(request.params && request.params.name || "");
			var block = toolMap(ctx)[name];
			var out = props.out || "local.response";
			var response = block
				? ctx.callBlock(block, { request: request, out: out }, { trace: false })
				: ctx.callBlock("mcp.tool.notFound", { request: request, out: out }, { trace: false });
			ctx.write(out, response);
			return response;
		}
	};
}())
