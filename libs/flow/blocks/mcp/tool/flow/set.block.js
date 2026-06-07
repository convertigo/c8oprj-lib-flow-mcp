const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:content-save-outline",
  "uses": [
    "mcp"
  ],
  "description": "Writes a named Flow sidecar and optionally registers it in the project.",
  "hooks": {
    "file": "set.hooks.js"
  },
  "properties": {
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project Flow sidecar name."
    },
    "flowSource": {
      "kind": "text",
      "type": "string",
      "description": "Canonical Flow YAML source to write."
    },
    "definition": {
      "kind": "literal",
      "type": "object",
      "description": "Canonical Flow definition object. Prefer direct node fields in definition.nodes[]."
    },
    "register": {
      "kind": "literal",
      "type": "boolean",
      "description": "Register/save the Flow DBO after writing."
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
				var write = ctx.flowSet(args.name, args.flowSource || "", args);
				write.registration = mcp.registerFlowDbo(args, write);
				return write;
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
