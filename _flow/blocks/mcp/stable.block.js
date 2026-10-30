const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "uses": [
    "mcp",
  ],
  "description": "Answers a stable MCP request (tools/list, a guide or skill) with the result kept for the same caller and revisions, or runs its nodes and keeps their response.",
  "longDescription": "The key of the kept result (mcp.js stableLookup) is computed before the nodes run, from the authenticated caller recorded by jwt.guardRequest and the revisions the result depends on; the envelope is rebuilt with the id of the request. A request that is not stable, has no authenticated caller or fails is answered by the nodes and not kept.",
  "summary": [
    "stable result -> {{out}}",
    "stable result",
  ],
  "icon": "mdi:cached",
  "private": true,
  "tags": [
    "mcp",
  ],
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC request object.",
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path the nodes write the MCP response to, and receiving the kept one.",
    },
  },
  "outputs": {
    "out": {
      "type": "object",
    },
  },
  "slots": [
    {
      "name": "nodes",
      "label": "Compute",
      "inline": true,
      "scope": "caller",
      "description": "Computes the response into out when no kept result answers.",
    },
  ],
  "children": [
    "nodes",
  ],
  "display": "stable -> ${input.out}",
  "hooks": {
    "file": "stable.hooks.js",
  },
  "runtime": "rhino",
}

(function () {
	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var out = props.out || "local.response";
			var lookup = mcp.stableLookup(ctx, request);
			if (lookup && lookup.response) {
				ctx.write(out, lookup.response);
				return lookup.response;
			}
			ctx.runNodes(node.nodes || []);
			var response = ctx.expr(out);
			mcp.stableKeep(ctx, request, lookup, response);
			return response;
		}
	};
}())
