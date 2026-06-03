(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var request = ctx.expr(props.request || "input.request");
			var mcp = ctx.lib("mcp");
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
