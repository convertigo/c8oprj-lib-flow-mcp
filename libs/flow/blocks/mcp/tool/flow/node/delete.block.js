const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:playlist-remove",
  "uses": [
    "mcp"
  ],
  "description": "Deletes one node from a named Flow sidecar.",
  "hooks": {
    "file": "delete.hooks.js"
  },
  "properties": {
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project Flow sidecar name."
    },
    "nodeId": {
      "kind": "text",
      "type": "string",
      "description": "Node id to delete."
    },
    "dryRun": {
      "kind": "literal",
      "type": "boolean",
      "description": "Apply mutation without writing the Flow sidecar."
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
				return ctx.lib("mcp").applyNodeMutation(ctx, args, {
					op: "delete",
					nodeId: args.nodeId
				});
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
