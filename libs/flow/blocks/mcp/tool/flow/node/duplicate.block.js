const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:playlist-plus",
  "uses": [
    "mcp"
  ],
  "description": "Duplicates one node in a named Flow sidecar.",
  "hooks": {
    "file": "duplicate.hooks.js"
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
      "description": "Source node id to duplicate."
    },
    "newId": {
      "kind": "text",
      "type": "string",
      "description": "Stable id for the duplicated node."
    },
    "properties": {
      "kind": "expression",
      "type": "object",
      "description": "Properties to merge into the duplicated node."
    },
    "parentNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Parent node receiving the duplicated node."
    },
    "beforeNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Insert before this sibling node."
    },
    "afterNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Insert after this sibling node."
    },
    "slot": {
      "kind": "text",
      "type": "string",
      "description": "Target slot when inserting inside a container."
    },
    "index": {
      "kind": "literal",
      "type": "number",
      "description": "Target insertion index."
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
				var patch = args.properties || {};
				patch = JSON.parse(JSON.stringify(patch));
				if (args.newId || args.newNodeId) {
					patch.id = String(args.newId || args.newNodeId);
				}
				if (!patch.id) {
					throw new Error("flow-node-duplicate requires newId or properties.id to avoid duplicate node ids.");
				}
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "copy",
					fromNodeId: args.nodeId,
					patch: patch
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
