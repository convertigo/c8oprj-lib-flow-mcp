const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:playlist-plus",
  "uses": [
    "mcp"
  ],
  "description": "Adds one node to a named Flow sidecar.",
  "hooks": {
    "file": "add.hooks.js"
  },
  "properties": {
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project Flow sidecar name."
    },
    "id": {
      "kind": "text",
      "type": "string",
      "description": "Stable id for the inserted node."
    },
    "block": {
      "kind": "text",
      "type": "string",
      "description": "Block name to instantiate."
    },
    "properties": {
      "kind": "expression",
      "type": "object",
      "description": "Properties to merge into the inserted node."
    },
    "node": {
      "kind": "expression",
      "type": "object",
      "description": "Complete node definition, alternative to id/block/properties."
    },
    "parentNodeId": {
      "kind": "text",
      "type": "string",
      "description": "Parent node receiving the inserted node."
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
	function nodeFromArgs(args) {
		var node = args.node ? JSON.parse(JSON.stringify(args.node)) : {};
		if (args.id !== undefined && args.id !== null && String(args.id) !== "") {
			node.id = String(args.id);
		}
		if (args.block !== undefined && args.block !== null && String(args.block) !== "") {
			node.block = String(args.block);
		}
		var props = args.properties || {};
		Object.keys(props).forEach(function (key) {
			node[key] = props[key];
		});
		if (!node.block) {
			throw new Error("flow-node-add requires block or node.block.");
		}
		if (!node.id) {
			throw new Error("flow-node-add requires id or node.id for stable future edits.");
		}
		return node;
	}

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
				return mcp.applyNodeMutation(ctx, args, position(args, {
					op: "insert",
					value: nodeFromArgs(args)
				}));
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
