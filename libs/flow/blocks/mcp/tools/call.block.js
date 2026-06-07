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
		if (String(blockName || "").indexOf(TOOL_PREFIX) !== 0) {
			return "";
		}
		return "flow-" + camelToKebab(String(blockName).substring(TOOL_PREFIX.length));
	}

	function toolMap(ctx) {
		var map = {};
		(ctx.blockList({ includePrivate: true, detail: "summary" }).blocks || []).forEach(function (block) {
			var blockId = block.block || block.blockId || block.name;
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
			var request = ctx.expr(prop(node, "request") || "input.request") || {};
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
