const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "uses": [
    "mcp",
  ],
  "private": true,
  "icon": "mdi:tools",
  "tags": [
    "mcp",
  ],
  "description": "Dispatches one MCP tools/call request by visible tool family.",
  "summary": [
    "tools/call -> {{out}}",
    "tools/call",
  ],
  "display": "tools.call -> ${input.out}",
  "hooks": {
    "file": "call.hooks.js",
  },
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response.",
    },
  },
  "runtime": "rhino",
  "outputs": {
    "out": {
      "type": "unknown",
    },
  },
}

(function () {
	var TOOL_PREFIX = "mcp.tool.flow.";
	var CODE_TOOL_PREFIX = "mcp.tool.code.";
	var AUTHORING_TOOL_PREFIX = "mcp.tool.authoring.";
	var FRONTEND_TOOL_PREFIX = "mcp.tool.frontend.";
	var TAG_TOOL_PREFIX = "mcp.tool.tags.";

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
		if (blockName.indexOf(TAG_TOOL_PREFIX) === 0) {
			return "tags-" + camelToKebab(blockName.substring(TAG_TOOL_PREFIX.length));
		}
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

	// An MCP client without resources/read (Vibe 3 lists MCP tools only) asks flow-resource-get for a guide or skill
	// URI. When the project owns no such resource, the Flow MCP resource answers, its text in structuredContent as the
	// other Flow tools return their data.
	var MCP_RESOURCE_URI = /^flow:\/\/(?:guide|lib|skills)\//;
	function unknownResource(response) {
		var result = response && response.result;
		var error = result && result.structuredContent && result.structuredContent.error;
		var code = error && error.code || response && response.error && response.error.data && response.error.data.code;
		return String(code || "") === "UNKNOWN_RESOURCE";
	}
	function mcpResourceThroughTool(ctx, mcp, request, response) {
		var args = request.params && request.params.arguments || {};
		var uri = String(args.uri || "").trim();
		if (!MCP_RESOURCE_URI.test(uri) || !unknownResource(response)) {
			return null;
		}
		var read = ctx.callBlock("mcp.resources.read", {
			request: { jsonrpc: "2.0", id: request.id === undefined ? null : request.id, method: "resources/read", params: { uri: uri } },
			out: "local.mcpResourceRead"
		}, { trace: false });
		var contents = read && read.result && read.result.contents;
		if (!contents || !contents.length) {
			return null;
		}
		var texts = [];
		for (var i = 0; i < contents.length; i++) {
			texts.push(String(contents[i] && contents[i].text || ""));
		}
		var text = texts.join("\n");
		return mcp.finalizeResponse(ctx, request, mcp.jsonRpcResult(request.id, {
			content: [{ type: "text", text: "OK. " + uri + " read as an MCP resource (" + text.length + " characters). Use structuredContent.text." }],
			structuredContent: {
				ok: true,
				uri: uri,
				mimeType: String(contents[0].mimeType || "text/markdown"),
				source: "resources/read",
				text: text
			}
		}));
	}
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var name = String(request.params && request.params.name || "");
			var out = props.out || "local.response";
			var response;
			try {
				// An expired leased MCP token was let through to read why it is refused (jwt.guardRequest): no tool runs.
				if (request.__flowMcpTokenExpired) {
					response = mcp.toolError(request, request.__flowMcpTokenExpired, ctx);
					ctx.write(out, response);
					return response;
				}
				var block = toolMap(ctx)[name];
				// Relayed answers belong to the legacy MCP: do not rewrap or normalize them.
				if (!block && mcp.legacyRelayTool(name)) {
					var relayed = mcp.legacyRelayCall(ctx, request);
					ctx.write(out, relayed);
					return relayed;
				}
				response = block
					? ctx.callBlock(block, { request: request, out: out }, { trace: false })
					: mcp.toolError(request, { code: "FLOW_MCP_TOOL_ERROR", message: "Unknown Flow MCP tool: " + name }, ctx);
				if (name === "flow-resource-get") {
					response = mcpResourceThroughTool(ctx, mcp, request, response) || response;
				}
				// Older Flow wrappers can still return a JSON-RPC error. At the tools/call boundary it is a tool error.
				if (response && response.error) {
					var error = response.error;
					var data = error.data || {};
					response = mcp.toolError(request, { code: data.code, message: error.message, hint: data.hint, details: data.details }, ctx);
				}
			} catch (error) {
				response = mcp.toolError(request, error, ctx);
			}
			ctx.write(out, response);
			return response;
		}
	};
}())
