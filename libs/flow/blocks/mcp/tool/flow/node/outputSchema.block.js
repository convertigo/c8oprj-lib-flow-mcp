const _meta = {
  "version": 1,
  "description": "Reads or resets the best known output schema for one Flow node.",
  "icon": "mdi:code-json",
  "uses": [
    "mcp"
  ],
  "properties": {
    "request": {
      "kind": "expression",
      "type": "object",
      "default": "input.request",
      "description": "MCP JSON-RPC tools/call request object."
    },
    "qname": {
      "kind": "text",
      "type": "string",
      "description": "Executable Flow DBO qname. Alias used by MCP clients."
    },
    "name": {
      "kind": "text",
      "type": "string",
      "description": "Project Flow sidecar name."
    },
    "nodeId": {
      "kind": "text",
      "type": "string",
      "description": "Node id whose output schema should be read."
    },
    "nodePointer": {
      "kind": "text",
      "type": "string",
      "description": "JSON pointer returned by flow-search when nodeId is ambiguous, for example /nodes/1/then/1."
    },
    "property": {
      "kind": "text",
      "type": "string",
      "description": "Output property to inspect. Defaults to the node's first write output."
    },
    "path": {
      "kind": "path",
      "type": "string",
      "description": "Optional scope path for the output when it cannot be inferred."
    },
    "source": {
      "kind": "text",
      "type": "string",
      "description": "Schema source to read: effective, declared, static or learned."
    },
    "action": {
      "kind": "text",
      "type": "string",
      "description": "Action: read (default) or reset to delete the learned node schema."
    },
    "detail": {
      "kind": "text",
      "type": "string",
      "description": "Response detail: compact (default) or full."
    },
    "out": {
      "kind": "path",
      "mode": "write",
      "default": "local.response",
      "description": "Scope path receiving the MCP response."
    }
  },
  "outputs": {
    "out": {
      "type": "object"
    }
  },
  "runtime": "rhino",
  "private": true,
  "tags": [
    "mcp"
  ],
  "display": "tool flow-node-output-schema -> {{ input.out }}"
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
	function actionFor(args) {
		var action = String(args.action || "read").toLowerCase();
		if (args.reset === true || args.remove === true || args["delete"] === true) {
			action = "reset";
		}
		return action;
	}

	return {
		run: function (ctx, node) {
			var props = ctx.props(node);
			var mcp = ctx.lib("mcp");
			var request = mcp.requestValue(ctx, props.request);
			var response = mcp.runToolBlock(ctx, request, {}, function (args) {
				args = mcp.withNamedFlowSource(ctx, args);
				var action = actionFor(args);
				if (action === "read" || action === "") {
					return ctx.nodeOutputSchemaSource(args);
				}
				if (action !== "reset") {
					throw new Error("flow-node-output-schema action must be read or reset.");
				}
				var resetArgs = {
					projectDir: args.projectDir,
					project: args.project,
					flowName: args.flowName || args.name,
					name: args.name || args.flowName,
					node: args.nodeId || args.node || args.id,
					property: args.property || "out",
					out: args.path || args.outPath || args.scope || ""
				};
				return ctx.schemaReset(resetArgs);
			});
			ctx.write(props.out || "local.response", response);
			return response;
		}
	};
}())
