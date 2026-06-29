const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:database-sync-outline",
  "tags": [
    "mcp",
    "flow",
    "inputs"
  ],
  "description": "Synchronizes FlowScript input declarations to the Flow DBO variables without changing FlowScript code.",
  "display": "tool flow-sync-inputs -> {{ input.out }}",
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

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				return mcp.syncFlowInputsDbo(args);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
