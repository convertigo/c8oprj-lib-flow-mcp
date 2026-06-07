const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:playlist-edit",
  "uses": [
    "mcp"
  ],
  "description": "Edits one node in a named Flow sidecar.",
  "hooks": {
    "file": "edit.hooks.js"
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
      "description": "Node id to edit."
    },
    "property": {
      "kind": "text",
      "type": "string",
      "description": "Single property to replace."
    },
    "value": {
      "kind": "expression",
      "type": "object",
      "description": "Replacement value for property."
    },
    "properties": {
      "kind": "expression",
      "type": "object",
      "description": "Properties to merge into the node."
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
			var mcp = ctx.lib("mcp");
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				var mutation;
				if (args.property !== undefined && args.property !== null && String(args.property) !== "") {
					mutation = {
						op: "replace",
						nodeId: args.nodeId,
						property: args.property,
						value: args.value
					};
				} else {
					var patch = args.properties;
					if (!patch || typeof patch !== "object") {
						throw new Error("flow-node-edit requires property+value or properties.");
					}
					mutation = {
						op: "merge",
						nodeId: args.nodeId,
						value: patch
					};
				}
				return mcp.applyNodeMutation(ctx, args, mutation);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
