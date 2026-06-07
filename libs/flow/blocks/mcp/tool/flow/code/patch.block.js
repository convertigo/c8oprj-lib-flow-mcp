const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-edit-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Applies a revision-checked FlowScript patch or replacement.",
  "display": "tool flow-code-patch -> {{ input.out }}",
  "hooks": {
    "file": "patch.hooks.js"
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
	function isDry(args) {
		return args && (args.dry === true || args.dryRun === true || String(args.dry) === "true" || String(args.dryRun) === "true");
	}

	function withSource(ctx, args, write) {
		var flow = ctx.flowGet(write.name, args);
		return Object.assign({}, write, { source: flow.source });
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var write = ctx.flowCodePatch(args);
				if (write.ok === true && !isDry(args)) {
					write.registration = mcp.registerFlowDbo(Object.assign({}, args, { name: write.name }), withSource(ctx, args, write));
				}
				return write;
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
