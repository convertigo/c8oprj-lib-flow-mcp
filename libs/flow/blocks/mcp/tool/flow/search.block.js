const _meta = {
  "version": 1,
  "private": true,
  "icon": "mdi:magnify-scan",
  "uses": [
    "mcp"
  ],
  "description": "Searches Flow sidecars, nodes, catalog entries and learned schemas.",
  "hooks": {
    "file": "search.hooks.js"
  },
  "properties": {
    "query": {
      "kind": "text",
      "type": "string",
      "description": "Search text. Multi-word queries match unordered tokens."
    },
    "scope": {
      "kind": "text",
      "type": "string",
      "default": "project",
      "description": "Search scope: project or workspace. Project scope also includes visible library samples."
    },
    "kinds": {
      "kind": "literal",
      "type": "array",
      "description": "Optional result kinds, such as flow, node, block, type or schema."
    },
    "context": {
      "kind": "literal",
      "type": "number",
      "description": "Number of neighboring nodes to include around node matches."
    },
    "limit": {
      "kind": "literal",
      "type": "number",
      "description": "Maximum number of matches to return."
    },
    "cursor": {
      "kind": "text",
      "type": "string",
      "description": "Pagination cursor returned by a previous search."
    },
    "includeLibrarySamples": {
      "kind": "literal",
      "type": "boolean",
      "default": true,
      "description": "Include sample_* Flows from visible Flow libraries while searching the project."
    }
  },
  "runtime": "rhino"
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, { workspaceSearch: true }, function (args) {
				if (String(args.scope || "") === "workspace" && !args.project && !args.projectDir) {
					return mcp.searchWorkspace(ctx, args);
				}
				return ctx.searchFlow(args);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
