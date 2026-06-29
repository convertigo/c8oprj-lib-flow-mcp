const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:puzzle-check-outline",
  "tags": [
    "mcp",
    "flowscript",
    "block",
    "mock"
  ],
  "description": "Lists explicit project-local mock blocks that still need implementation.",
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "project": {
      "kind": "text",
      "type": "string",
      "description": "Target Convertigo project name."
    },
    "query": {
      "kind": "text",
      "type": "string",
      "description": "Optional block name or namespace filter."
    },
    "q": {
      "kind": "text",
      "type": "string",
      "description": "Alias for query."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  },
  "runtime": "rhino",
  "display": "tool flow-block-mock-list -> {{ input.out }}"
}

(function () {
	function prop(node, key) {
		return node && node.props && node.props[key] !== undefined ? node.props[key] : node && node[key];
	}

	function contains(haystack, needle) {
		if (!needle) {
			return true;
		}
		return String(haystack || "").toLowerCase().indexOf(String(needle).toLowerCase()) !== -1;
	}

	function isMock(block) {
		if (!block) {
			return false;
		}
		if (block.mock === true) {
			return true;
		}
		var tags = block.tags || [];
		for (var i = 0; i < tags.length; i++) {
			if (String(tags[i]).toLowerCase() === "mock") {
				return true;
			}
		}
		return false;
	}

	function compactMock(block) {
		return {
			block: block.blockId || block.block || block.name,
			description: block.description || block.desc || "",
			file: block.file || "",
			outputs: block.outputs || {},
			properties: block.properties || block.props || {},
			visibility: block.visibility || (block["private"] === true ? "private" : "public")
		};
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, prop(node, "request"));
			var out = props.out || "local.response";
			var response;
			try {
				var args = mcp.prepareToolArguments(ctx, request, { resolveProject: true });
				if (!args.project && !args.projectDir) {
					throw new Error("flow-block-mock-list requires project:\"<target project>\" or projectDir for standalone tests.");
				}
				var query = String(args.query || args.q || "").trim();
				var catalog = ctx.blockList({
					projectDir: args.projectDir,
					includePrivate: true,
					includeInternal: true,
					detail: "compact",
					limit: 1000,
					doc: false,
					hints: false
				});
				var mocks = [];
				(catalog.blocks || []).forEach(function (block) {
					var id = block.blockId || block.block || block.name || "";
					if (isMock(block) && contains(id + " " + (block.description || block.desc || ""), query)) {
						mocks.push(compactMock(block));
					}
				});
				mocks.sort(function (a, b) {
					return String(a.block).localeCompare(String(b.block));
				});
				response = mcp.toolResponse(request, {
					ok: true,
					count: mocks.length,
					mocks: mocks,
					complete: mocks.length === 0,
					next: mocks.length
						? "Implement or remove mock:true blocks before claiming the parent Flow is complete."
						: "No explicit mock blocks remain in this project."
				}, ctx);
			} catch (e) {
				response = mcp.toolError(request, e, ctx);
			}
			ctx.write(out, response);
			return response;
		}
	};
}())
