const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:sitemap-outline",
  "uses": [
    "mcp"
  ],
  "description": "Applies one or more mutations to a named Flow sidecar.",
  "hooks": {
    "file": "edit.hooks.js"
  },
  "properties": {
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project Flow sidecar name."
    },
    "mutation": {
      "kind": "expression",
      "type": "object",
      "description": "Single Flow mutation to apply."
    },
    "mutations": {
      "kind": "expression",
      "type": "array",
      "description": "Flow mutations to apply in order."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "description": "Apply mutations without writing the Flow sidecar."
    },
    "flowSource": {
      "kind": "text",
      "type": "string",
      "description": "Optional Flow YAML source used instead of loading name."
    },
    "definition": {
      "kind": "expression",
      "type": "object",
      "description": "Optional Flow definition object used instead of loading name."
    },
    "detail": {
      "kind": "text",
      "type": "string",
      "description": "Response detail: summary (default) or full."
    }
  },
  "runtime": "rhino"
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var response = ctx.lib("mcp").runToolBlock(ctx, request, {}, function (args) {
				return ctx.lib("mcp").applyNamedFlowMutation(ctx, args);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
