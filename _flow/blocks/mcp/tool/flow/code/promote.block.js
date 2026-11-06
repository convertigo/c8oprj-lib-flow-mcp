const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "private": true,
  "icon": "mdi:source-commit",
  "tags": [
    "mcp",
    "flowscript",
    "code",
  ],
  "description": "Promotes a checked FlowScript working copy to the official Flow model.",
  "display": "tool flow-code-promote -> ${input.out}",
  "hooks": {
    "file": "promote.hooks.js",
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
  "uses": ["mcp", "crud-fastpath"],
}

(function () {
	function withSource(ctx, args, write) {
		var flow = ctx.flowGet(write.name, args);
		return Object.assign({}, write, { source: flow.source, code: flow.code });
	}

	// Without a working copy, the Flow was promoted already, or a project-save wrote its draft to disk before any
	// promotion (a Flow file that no Flow declares): its saved source is promoted as is. A Flow never written refuses,
	// with the code-set call to make first.
	function promoteSaved(ctx, args, missing) {
		var saved = null;
		try {
			saved = ctx.flowGet(missing.name, args);
		} catch (_unknownFlow) {
			saved = null;
		}
		if (!saved || typeof saved.code !== "string" || !saved.revision) {
			var project = String(args.project || "");
			missing.error.hint = "No Flow named " + missing.name + " exists yet: write it with code-set({" +
				(project ? "project:\"" + project + "\", " : "") + "name:\"" + missing.name + "\", code}), run it with code-run, then promote it.";
			return missing;
		}
		var write = ctx.flowCodePromote(Object.assign({}, args, { code: saved.code, revision: String(saved.revision) }));
		if (write.ok === true) {
			write.note = "No working copy of " + missing.name + ": its saved source (revision " + String(saved.revision) +
				") was promoted as is. Nothing else was changed.";
		}
		return write;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				ctx.lib("crud-fastpath").assertWritable(ctx, args);
				mcp.assertProjectSaveAllowed(args);
				mcp.assertFlowNameFree(args);
				var write = ctx.flowCodePromote(args);
				if (write.ok === false && write.error && write.error.code === "FLOW_CODE_DRAFT_MISSING" &&
						(args.code === undefined || args.code === null)) {
					write = promoteSaved(ctx, args, write);
				}
				if (write.ok === true) {
					write.registration = mcp.registerFlowDbo(Object.assign({}, args, { name: write.name }), withSource(ctx, args, write));
				}
				return write;
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
