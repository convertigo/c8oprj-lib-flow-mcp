const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:playlist-play",
  "uses": [
    "mcp"
  ],
  "description": "Moves one node in a named Flow sidecar.",
  "hooks": {
    "file": "move.hooks.js"
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
      "description": "Node id to move."
    },
    "parentNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Parent node receiving the moved node."
    },
    "beforeNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Move before this sibling node."
    },
    "afterNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Move after this sibling node."
    },
    "slot": {
      "kind": "text",
      "type": "string",
      "description": "Target slot when moving inside a container."
    },
    "index": {
      "kind": "literal",
      "type": "number",
      "description": "Target insertion index."
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
	function position(args, mutation) {
		["beforeNodeId", "afterNodeId", "parentNodeId", "slot", "index"].forEach(function (key) {
			if (args[key] !== undefined && args[key] !== null && String(args[key]) !== "") {
				mutation[key] = args[key];
			}
		});
		return mutation;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				if (!args.beforeNodeId && !args.afterNodeId && !args.parentNodeId && args.index === undefined) {
					throw new Error("flow-node-move requires beforeNodeId, afterNodeId, parentNodeId or index.");
				}
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "move",
					fromNodeId: args.nodeId
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
