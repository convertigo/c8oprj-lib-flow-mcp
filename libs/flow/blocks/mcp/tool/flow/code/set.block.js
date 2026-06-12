const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:file-check-outline",
  "tags": [
    "mcp",
    "flowscript",
    "code"
  ],
  "description": "Writes and checks the FlowScript working copy with optional revision checking.",
  "display": "tool flow-code-set -> {{ input.out }}",
  "hooks": {
    "file": "set.hooks.js"
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

	function isDraft(args) {
		return args && (args.draft === true || String(args.draft) === "true" || String(args.mode) === "draft" || String(args.stage) === "draft");
	}

	function withSource(ctx, args, write) {
		var flow = ctx.flowGet(write.name, args);
		return Object.assign({}, write, { source: flow.source, code: flow.code });
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var write = ctx.flowCodeSet(args);
				if (write.ok === true && !isDry(args) && !isDraft(args)) {
					write.registration = mcp.registerFlowDbo(Object.assign({}, args, { name: write.name }), withSource(ctx, args, write));
				}
				return write;
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
